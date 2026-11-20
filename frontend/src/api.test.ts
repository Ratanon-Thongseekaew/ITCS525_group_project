import { afterEach, expect, test, vi } from 'vitest'

import { getDashboard, getResaleStoreSummary, validateContractorReport } from './api'

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
