/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '@/api'
import { stubRadixBrowserApis } from '@/test/handoff-fixtures'
import { signInAs } from '@/test/auth'
import { SortingOverviewPage } from './SortingOverviewPage'

const sites: api.Store[] = [
  { id: 1, code: 'DASH-BKK', name: 'Bangkok Flagship' },
  { id: 2, code: 'DASH-CNX', name: 'Chiang Mai Outlet' },
]

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
    stubRadixBrowserApis()
    signInAs('manager', { id: 20 })
    vi.spyOn(api, 'getSortingSites').mockResolvedValue(sites)
    vi.spyOn(api, 'getSortingStats').mockResolvedValue(stats)
    vi.spyOn(api, 'getBins').mockResolvedValue(bins)
    vi.spyOn(api, 'getRecentGarments').mockResolvedValue(garments)
  })

  afterEach(() => {
    cleanup()
    window.sessionStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('shows all of the manager’s sites combined, with the site on every row', async () => {
    render(<SortingOverviewPage />)

    expect(await screen.findAllByText('BIN-RC-007')).toHaveLength(2)
    expect(api.getSortingSites).toHaveBeenCalledWith('test-token')
    expect(api.getBins).toHaveBeenCalledWith('test-token', undefined)
    expect(api.getSortingStats).toHaveBeenCalledWith('test-token', undefined)
    expect(screen.getAllByText('Bangkok Flagship').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chiang Mai Outlet').length).toBeGreaterThan(0)
    expect(screen.getByText('Sealed / Ready for handoff')).toBeInTheDocument()
    expect(screen.getByText('Repair / Upcycle', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  test('is read only and has no account picker', async () => {
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    for (const name of [/Good \/ Reusable/i, /Seal/i, /New Bin/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/login isn.t available yet/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Manager/i })).not.toBeInTheDocument()
  })

  test('shows the signed-in manager', async () => {
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    expect(screen.getByRole('group', { name: 'Signed-in account and site' })).toHaveTextContent(
      'Test manager',
    )
  })

  test('offers the sites from the API and loads one site when it is chosen', async () => {
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    fireEvent.keyDown(screen.getByRole('combobox', { name: /Site/i }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('option', { name: 'Chiang Mai Outlet' }))

    await waitFor(() => expect(api.getBins).toHaveBeenCalledWith('test-token', 2))
    expect(api.getSortingStats).toHaveBeenCalledWith('test-token', 2)
  })

  test('shows the site, without a choice, for a manager of one site', async () => {
    vi.mocked(api.getSortingSites).mockResolvedValue([sites[0]])
    render(<SortingOverviewPage />)
    await screen.findAllByText('BIN-RC-007')

    const account = screen.getByRole('group', { name: 'Signed-in account and site' })
    expect(account).toHaveTextContent('SiteBangkok Flagship')
    expect(screen.queryByRole('combobox', { name: /Site/i })).not.toBeInTheDocument()
  })

  test('is for managers and administrators: staff see a message and nothing loads', async () => {
    window.sessionStorage.clear()
    signInAs('staff')
    render(<SortingOverviewPage />)

    expect(
      screen.getByText('Sorting Overview is available to manager and administrator accounts only.'),
    ).toBeInTheDocument()
    expect(api.getSortingSites).not.toHaveBeenCalled()
    expect(api.getBins).not.toHaveBeenCalled()
  })

  test('lets an administrator in too', async () => {
    window.sessionStorage.clear()
    signInAs('admin', { id: 30 })
    render(<SortingOverviewPage />)

    await screen.findAllByText('BIN-RC-007')
    expect(api.getBins).toHaveBeenCalledWith('test-token', undefined)
  })

  test('shows an error when the overview cannot be loaded', async () => {
    vi.spyOn(api, 'getBins').mockRejectedValue(new Error('You don’t have access to this site.'))
    render(<SortingOverviewPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You don’t have access to this site.',
    )
  })
})
