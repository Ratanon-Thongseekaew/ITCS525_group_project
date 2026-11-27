import { afterEach, expect, test, vi } from 'vitest'

import {
  approveHandoff,
  changePassword,
  closeHandoff,
  createUser,
  getDashboard,
  getHandoffReadyBins,
  getHandoffs,
  getResaleStoreSummary,
  handoffPhotoUrl,
  listSites,
  parseAndValidateContractorFile,
  recordHandoffAtPickup,
  resetUserPassword,
  setUnauthorizedHandler,
  submitEprQuarter,
} from './api'

afterEach(() => {
  vi.restoreAllMocks()
})

test('sends dashboard filters as query parameters', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  await getDashboard('test-token', {
    frequency: 'quarterly',
    year: 2026,
    quarter: 4,
    site_id: 2,
    contractor_id: 3,
  })

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/dashboard?frequency=quarterly&year=2026&quarter=4&site_id=2&contractor_id=3',
    { signal: undefined, headers: { Authorization: 'Bearer test-token' } },
  )
})

test('submits an EPR quarter with the token and no actor in the body', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ status: 'submitted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  await submitEprQuarter('test-token', 2026, 4)

  expect(fetchMock).toHaveBeenCalledWith('/api/epr/quarterly-report/submit?year=2026&quarter=4', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
  })
})

test('ends the session when a signed-in dashboard request is rejected', async () => {
  const handler = vi.fn()
  setUnauthorizedHandler(handler)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }))

  await expect(
    getDashboard('expired-token', { frequency: 'monthly', year: 2026 }),
  ).rejects.toThrow()
  expect(handler).toHaveBeenCalledWith('expired-token')
  setUnauthorizedHandler(() => {})
})

test('sends the token, month and contractor with a contractor report file', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ filename: 'report.csv', rows: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  await parseAndValidateContractorFile('test-token', {
    filename: 'report.csv',
    contentBase64: 'YmluX2lk',
    reportMonth: '2026-10',
    contractorId: 2,
  })

  expect(fetchMock).toHaveBeenCalledWith('/api/contractor-reports/parse-and-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify({
      filename: 'report.csv',
      content_base64: 'YmluX2lk',
      report_month: '2026-10',
      contractor_id: 2,
    }),
  })
})

test('requests the persisted resale summary', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ stores: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  await getResaleStoreSummary('test-token')

  expect(fetchMock).toHaveBeenCalledWith('/api/resale-bins/summary', {
    signal: undefined,
    headers: { Authorization: 'Bearer test-token' },
  })
})

function mockJsonResponse(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
}

test('requests ready handoff bins and handoff records with optional filters', async () => {
  const fetchMock = mockJsonResponse({ bins: [], handoffs: [] })

  await getHandoffReadyBins()
  await getHandoffReadyBins(2)
  await getHandoffs({ status: 'disputed', site_id: 1 })

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/handoffs/bins',
    '/api/handoffs/bins?site_id=2',
    '/api/handoffs?status=disputed&site_id=1',
  ])
})

test('approves and closes handoffs with JSON bodies', async () => {
  const fetchMock = mockJsonResponse({})

  await approveHandoff(7, 2)
  await closeHandoff(7, 2)

  for (const [index, action] of ['approve', 'close'].entries()) {
    expect(fetchMock).toHaveBeenNthCalledWith(index + 1, `/api/handoffs/7/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: 2 }),
    })
  }
})

test('shows the API error detail when a handoff request is rejected', async () => {
  mockJsonResponse({ detail: 'A manager must approve this disputed handoff before closing.' }, 409)

  await expect(approveHandoff(7, 2)).rejects.toThrow(
    'A manager must approve this disputed handoff before closing.',
  )
})

test('records a handoff with its evidence and scale photo as multipart form data', async () => {
  const fetchMock = mockJsonResponse({})
  const photo = new Blob(['png'], { type: 'image/png' })

  await recordHandoffAtPickup({
    bin_id: 4,
    contractor_id: 1,
    actor_id: 3,
    picked_up_at: '2026-11-21T03:15:00.000Z',
    staff_weight_kg: 40,
    driver_weight_kg: 40.5,
    driver_name: 'Somchai P.',
    vehicle_plate_number: '1KB-2345',
    scale_photo: photo,
  })

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/handoffs/pickups')
  expect(init?.method).toBe('POST')
  expect(init?.headers).toBeUndefined()
  const form = init?.body as FormData
  expect(form.get('bin_id')).toBe('4')
  expect(form.get('contractor_id')).toBe('1')
  expect(form.get('staff_weight_kg')).toBe('40')
  expect(form.get('driver_weight_kg')).toBe('40.5')
  expect(form.get('vehicle_plate_number')).toBe('1KB-2345')
  expect(form.get('scale_photo')).toBeInstanceOf(Blob)
})

test('keeps external scale photo links and API paths usable', () => {
  expect(handoffPhotoUrl(null)).toBeNull()
  expect(handoffPhotoUrl('/api/handoffs/7/scale-photo')).toBe('/api/handoffs/7/scale-photo')
  expect(handoffPhotoUrl('https://example.invalid/scale.jpg')).toBe(
    'https://example.invalid/scale.jpg',
  )
})

const apiUser = {
  id: 7,
  username: 'narin@example.com',
  role: 'staff',
  full_name: 'Narin S.',
  must_change_password: true,
  store: { id: 2, code: 'BKK', name: 'Bangkok' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('creates a user without a password and returns the one-time temporary password', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(jsonResponse({ ...apiUser, temporary_password: 'Abcdefg23456hj' }, 201))

  const created = await createUser('tok', {
    username: 'narin@example.com',
    role: 'staff',
    full_name: 'Narin S.',
    site_id: 2,
  })

  expect(created.temporary_password).toBe('Abcdefg23456hj')
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/users')
  expect(init?.method).toBe('POST')
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  expect(JSON.parse(String(init?.body))).toEqual({
    username: 'narin@example.com',
    role: 'staff',
    full_name: 'Narin S.',
    site_id: 2,
  })
})

test('resets a password, lists stores and changes the own password with the token', async () => {
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(jsonResponse({ ...apiUser, temporary_password: 'Zyxwvut23456hj' }))
    .mockResolvedValueOnce(jsonResponse([apiUser.store]))
    .mockResolvedValueOnce(jsonResponse({ ...apiUser, must_change_password: false }))

  expect((await resetUserPassword('tok', 7)).temporary_password).toBe('Zyxwvut23456hj')
  expect(await listSites('tok')).toEqual([apiUser.store])
  expect((await changePassword('tok', 'old-password', 'new-password')).must_change_password).toBe(
    false,
  )

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/users/7/reset-password',
    '/api/sites',
    '/api/auth/change-password',
  ])
  expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
    current_password: 'old-password',
    new_password: 'new-password',
  })
  for (const [, init] of fetchMock.mock.calls) {
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' })
  }
})
