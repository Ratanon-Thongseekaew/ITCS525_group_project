import { afterEach, expect, test, vi } from 'vitest'

import {
  changePassword,
  createUser,
  getDashboard,
  getResaleStoreSummary,
  listSites,
  resetUserPassword,
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
