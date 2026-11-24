import { afterEach, expect, test, vi } from 'vitest'

import {
  approveHandoff,
  closeHandoff,
  getDashboard,
  getHandoffReadyBins,
  getHandoffs,
  getResaleStoreSummary,
  handoffPhotoUrl,
  recordHandoffAtPickup,
  validateContractorReport,
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

  await getDashboard({
    frequency: 'quarterly',
    year: 2026,
    quarter: 4,
    site_id: 2,
    contractor_id: 3,
  })

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/dashboard?frequency=quarterly&year=2026&quarter=4&site_id=2&contractor_id=3',
    { signal: undefined },
  )
})

test('sends all six disposition categories for contractor report validation', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ rows: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  const rows = [
    {
      row: 1,
      received_kg: 100,
      dispositions: {
        upcycled_kg: 10,
        fibre_to_fibre_kg: 20,
        downcycled_kg: 10,
        exported_kg: 5,
        landfilled_kg: 10,
        incinerated_energy_recovery_kg: 5,
      },
    },
  ]

  await validateContractorReport(rows)

  expect(fetchMock).toHaveBeenCalledWith('/api/contractor-reports/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
})

test('requests the persisted resale summary', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ stores: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  await getResaleStoreSummary()

  expect(fetchMock).toHaveBeenCalledWith('/api/resale-bins/summary', { signal: undefined })
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
