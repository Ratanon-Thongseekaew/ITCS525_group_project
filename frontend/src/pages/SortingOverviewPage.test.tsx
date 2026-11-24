/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '@/api'
import { SortingOverviewPage } from './SortingOverviewPage'

const options: api.HandoffOptions = {
  sites: [
    { id: 1, code: 'DASH-BKK', name: 'Bangkok Flagship' },
    { id: 2, code: 'DASH-CNX', name: 'Chiang Mai Outlet' },
  ],
  contractors: [],
  actors: [
    { id: 7, username: 'staff.bkk@example.test', role: 'staff', site_ids: [1] },
    { id: 20, username: 'manager.all@example.test', role: 'manager', site_ids: [1, 2] },
    { id: 21, username: 'manager.bkk@example.test', role: 'manager', site_ids: [1] },
  ],
}

const stats: api.SortingStatsResponse = {
  total_sorted_today: 9,
  resale_count: 4,
  recycle_count: 3,
  repair_count: 2,
  resale_percentage: 44.4,
  active_resale_bin_code: null,
  active_resale_bin_items: 0,
  active_recycle_bin_code: null,
  active_recycle_bin_items: 0,
  active_repair_bin_code: null,
  active_repair_bin_items: 0,
}

const bins: api.BinRecord[] = [
  {
    id: 1,
    site_id: 1,
    site_name: 'Bangkok Flagship',
    bin_code: 'BIN-RS-001',
    bin_type: 'resale',
    status: 'active',
    item_count: 5,
    total_weight_kg: 2.5,
    max_capacity: 50,
    created_at: '2026-11-24T08:00:00Z',
    ready_at: null,
    closed_at: null,
    notes: null,
  },
  {
    id: 2,
    site_id: 2,
    site_name: 'Chiang Mai Outlet',
    bin_code: 'BIN-RC-007',
    bin_type: 'recycle',
    status: 'ready',
    item_count: 12,
    total_weight_kg: 6,
    max_capacity: 50,
    created_at: '2026-11-24T09:00:00Z',
    ready_at: '2026-11-24T10:00:00Z',
    closed_at: null,
    notes: null,
  },
]

const garments: api.GarmentItem[] = [
  {
    id: 1,
    site_id: 2,
    site_name: 'Chiang Mai Outlet',
    condition: 'repair_upcycle',
    category: 'Tops',
    bin_id: 2,
    bin_code: 'BIN-RC-007',
    weight_kg: 0.4,
    notes: null,
    created_at: '2026-11-24T09:30:00Z',
  },
]

describe('SortingOverviewPage', () => {
  beforeEach(() => {
    // jsdom has no layout; Radix Select calls this when it opens.
    Element.prototype.scrollIntoView ??= vi.fn()
    vi.spyOn(api, 'getHandoffOptions').mockResolvedValue(options)
    vi.spyOn(api, 'getSortingStats').mockResolvedValue(stats)
    vi.spyOn(api, 'getBins').mockResolvedValue(bins)
    vi.spyOn(api, 'getRecentGarments').mockResolvedValue(garments)
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '20'),
      setItem: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('shows all of the manager’s sites combined, with the site on every row', async () => {
    render(<SortingOverviewPage />)

    expect(await screen.findAllByText('BIN-RC-007')).toHaveLength(2)
    expect(api.getBins).toHaveBeenCalledWith(20, undefined)
    expect(api.getSortingStats).toHaveBeenCalledWith(20, undefined)
    expect(screen.getAllByText('Bangkok Flagship').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chiang Mai Outlet').length).toBeGreaterThan(0)
    expect(screen.getByText('Sealed / Ready for handoff')).toBeInTheDocument()
    expect(screen.getByText('Repair / Upcycle', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  test('is read only: it offers no sorting, sealing or bin creation', async () => {
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    for (const name of [/Good \/ Reusable/i, /Seal/i, /New Bin/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  test('asks for a manager account before loading anything', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() })
    render(<SortingOverviewPage />)

    expect(
      await screen.findByText('Choose your manager account to see sorting data.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(api.getHandoffOptions).toHaveBeenCalled())
    expect(api.getBins).not.toHaveBeenCalled()
  })

  test('does not list staff accounts as managers', async () => {
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    fireEvent.click(screen.getByRole('combobox', { name: /Manager/i }))

    expect(
      await screen.findByRole('option', { name: 'manager.bkk@example.test' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'staff.bkk@example.test' })).not.toBeInTheDocument()
  })

  test('shows an error when the overview cannot be loaded', async () => {
    vi.spyOn(api, 'getBins').mockRejectedValue(new Error('You don’t have access to this site.'))
    render(<SortingOverviewPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You don’t have access to this site.',
    )
  })
})
