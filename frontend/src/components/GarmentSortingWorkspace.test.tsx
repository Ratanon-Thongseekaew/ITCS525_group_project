/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '@/api'
import type { HandoffWorkspace } from '@/lib/use-handoff-workspace'
import { GarmentSortingWorkspace } from './GarmentSortingWorkspace'

const STAFF = { id: 7, username: 'staff.bkk@example.test', role: 'staff' as const, site_ids: [1] }

const { workspaceRef } = vi.hoisted(() => ({
  workspaceRef: { current: null as HandoffWorkspace | null },
}))

// The real hook reads staff accounts from the API and browser storage; the screen only needs
// the chosen staff member and their site.
vi.mock('@/lib/use-handoff-workspace', () => ({
  useHandoffWorkspace: () => workspaceRef.current,
}))

function workspaceFor(actor: typeof STAFF | null): HandoffWorkspace {
  return {
    options: null,
    staffAccounts: [STAFF],
    isLoading: false,
    error: null,
    retry: vi.fn(),
    actor,
    setActorId: vi.fn(),
    siteId: actor ? 1 : null,
    siteName: actor ? 'Bangkok Flagship' : null,
  }
}

describe('GarmentSortingWorkspace', () => {
  const mockStats: api.SortingStatsResponse = {
    total_sorted_today: 36,
    resale_count: 14,
    recycle_count: 22,
    repair_count: 3,
    resale_percentage: 38.9,
    active_resale_bin_code: 'BIN-RS-001',
    active_resale_bin_items: 14,
    active_recycle_bin_code: 'BIN-RC-001',
    active_recycle_bin_items: 22,
    active_repair_bin_code: 'BIN-RP-001',
    active_repair_bin_items: 3,
  }

  const mockActiveBins: api.ActiveBinsResponse = {
    resale_bin: {
      id: 1,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      bin_code: 'BIN-RS-001',
      bin_type: 'resale',
      status: 'active',
      item_count: 14,
      total_weight_kg: 5.2,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      ready_at: null,
      closed_at: null,
      notes: 'Active counter bin',
    },
    recycle_bin: {
      id: 2,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      bin_code: 'BIN-RC-001',
      bin_type: 'recycle',
      status: 'active',
      item_count: 22,
      total_weight_kg: 8.4,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      ready_at: null,
      closed_at: null,
      notes: 'Active recycle bin',
    },
    repair_bin: {
      id: 3,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      bin_code: 'BIN-RP-001',
      bin_type: 'repair',
      status: 'active',
      item_count: 3,
      total_weight_kg: 1.1,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      ready_at: null,
      closed_at: null,
      notes: 'Active repair bin',
    },
  }

  const mockBins: api.BinRecord[] = [
    mockActiveBins.resale_bin!,
    mockActiveBins.recycle_bin!,
    mockActiveBins.repair_bin!,
    {
      id: 4,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      bin_code: 'BIN-RS-000',
      bin_type: 'resale',
      status: 'closed',
      item_count: 50,
      total_weight_kg: 18.5,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      ready_at: null,
      closed_at: new Date().toISOString(),
      notes: 'Completed batch',
    },
  ]

  const mockRecentGarments: api.GarmentItem[] = [
    {
      id: 101,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      condition: 'good_reusable',
      category: 'Tops',
      bin_id: 1,
      bin_code: 'BIN-RS-001',
      weight_kg: 0.35,
      notes: null,
      created_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    workspaceRef.current = workspaceFor(STAFF)
    vi.spyOn(api, 'getSortingStats').mockResolvedValue(mockStats)
    vi.spyOn(api, 'getActiveBins').mockResolvedValue(mockActiveBins)
    vi.spyOn(api, 'getBins').mockResolvedValue(mockBins)
    vi.spyOn(api, 'getRecentGarments').mockResolvedValue(mockRecentGarments)
    vi.spyOn(api, 'sortGarment').mockResolvedValue({
      garment: {
        id: 102,
        site_id: 1,
        site_name: 'Bangkok Flagship',
        condition: 'good_reusable',
        category: 'Tops',
        bin_id: 1,
        bin_code: 'BIN-RS-001',
        weight_kg: null,
        notes: null,
        created_at: new Date().toISOString(),
      },
      bin: {
        ...mockActiveBins.resale_bin!,
        item_count: 15,
      },
      message: 'Item successfully sorted as Good/Reusable (Resale) into BIN-RS-001.',
    })
    vi.spyOn(api, 'createBin').mockResolvedValue({
      id: 5,
      site_id: 1,
      site_name: 'Bangkok Flagship',
      bin_code: 'BIN-RS-002',
      bin_type: 'resale',
      status: 'active',
      item_count: 0,
      total_weight_kg: 0,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      ready_at: null,
      closed_at: null,
      notes: null,
    })
    vi.spyOn(api, 'closeBin').mockResolvedValue({
      ...mockActiveBins.resale_bin!,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test('renders the garment sorting workspace with header, KPIs, and quick-tap controls', async () => {
    render(<GarmentSortingWorkspace />)

    expect(
      screen.getByRole('heading', { name: 'Garment Sorting & Bin Records' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Your work, clearly organized.' }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('38.9%')).toBeInTheDocument()
      expect(screen.getAllByText('BIN-RS-001').length).toBeGreaterThan(0)
      expect(screen.getAllByText('BIN-RC-001').length).toBeGreaterThan(0)
    })

    expect(screen.getByRole('button', { name: /Good \/ Reusable/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Worn \/ Recyclable/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Repair \/ Upcycle/i })).toBeInTheDocument()
  })

  test('handles quick-tap sorting to repair with a single tap', async () => {
    render(<GarmentSortingWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: /Repair \/ Upcycle/i }))

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledTimes(1)
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 7,
          condition: 'repair_upcycle',
          category: 'Tops',
        }),
      )
    })
  })

  test.each(['u', '3'])('sorts to repair with keyboard shortcut %s', async (key) => {
    render(<GarmentSortingWorkspace />)

    fireEvent.keyDown(window, { key })

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({ condition: 'repair_upcycle' }),
      )
    })
  })

  test('filters the bin list to repair bins', async () => {
    render(<GarmentSortingWorkspace />)
    await waitFor(() => expect(screen.getAllByText('BIN-RP-001').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('radio', { name: 'Repair' }))

    expect(screen.queryByText('BIN-RS-000')).not.toBeInTheDocument()
    expect(screen.getAllByText('BIN-RP-001').length).toBeGreaterThan(0)
  })

  test('handles quick-tap sorting to direct resale', async () => {
    render(<GarmentSortingWorkspace />)

    const resaleBtn = screen.getByRole('button', { name: /Good \/ Reusable/i })
    fireEvent.click(resaleBtn)

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'good_reusable',
          category: 'Tops',
        }),
      )
    })

    expect(
      await screen.findByText(/Item successfully sorted as Good\/Reusable/i),
    ).toBeInTheDocument()
  })

  test('handles quick-tap sorting to recycling', async () => {
    render(<GarmentSortingWorkspace />)

    const recycleBtn = screen.getByRole('button', { name: /Worn \/ Recyclable/i })
    fireEvent.click(recycleBtn)

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'worn_recyclable',
          category: 'Tops',
        }),
      )
    })
  })

  test('opens and closes the new bin modal', async () => {
    render(<GarmentSortingWorkspace />)

    const newBinBtn = screen.getByRole('button', { name: /New Bin Record/i })
    fireEvent.click(newBinBtn)

    expect(screen.getByText('Create New Bin Record')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText('Create New Bin Record')).not.toBeInTheDocument()
  })

  test('ignores sorting shortcuts while a dialog has focus', async () => {
    render(<GarmentSortingWorkspace />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /New Bin Record/i })).toBeEnabled(),
    )

    fireEvent.click(screen.getByRole('button', { name: /New Bin Record/i }))
    const recycling = screen.getByRole('radio', { name: 'Recycling' })
    recycling.focus()
    fireEvent.keyDown(recycling, { key: 'r' })
    fireEvent.keyDown(recycling, { key: '2' })

    expect(api.sortGarment).not.toHaveBeenCalled()
  })

  test('responds to keyboard shortcut for quick intake', async () => {
    render(<GarmentSortingWorkspace />)

    fireEvent.keyDown(window, { key: 'r' })

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'good_reusable',
        }),
      )
    })
  })

  test("loads the bins, stats and feed for the chosen staff member's site", async () => {
    render(<GarmentSortingWorkspace />)

    await waitFor(() => {
      expect(api.getSortingStats).toHaveBeenCalledWith(7, 1)
      expect(api.getActiveBins).toHaveBeenCalledWith(7, 1)
      expect(api.getBins).toHaveBeenCalledWith(7, 1)
      expect(api.getRecentGarments).toHaveBeenCalledWith(7, 1, 10)
    })
  })

  test('sends the acting staff member when sorting, creating and sealing bins', async () => {
    render(<GarmentSortingWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: /Good \/ Reusable/i }))
    await waitFor(() =>
      expect(api.sortGarment).toHaveBeenCalledWith(expect.objectContaining({ actor_id: 7 })),
    )

    fireEvent.click(screen.getAllByRole('button', { name: /Seal \/ Close Bin/i })[0])
    fireEvent.click(await screen.findByRole('button', { name: /Confirm & Seal/i }))
    await waitFor(() => expect(api.closeBin).toHaveBeenCalledWith(1, 7, undefined))

    fireEvent.click(screen.getByRole('button', { name: /New Bin Record/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create Bin/i }))
    await waitFor(() =>
      expect(api.createBin).toHaveBeenCalledWith(
        expect.objectContaining({ actor_id: 7, bin_type: 'resale' }),
      ),
    )
  })

  test('shows the server message when sorting fails', async () => {
    vi.spyOn(api, 'sortGarment').mockRejectedValue(
      new Error('Staff can only use bins at their site.'),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<GarmentSortingWorkspace />)

    fireEvent.click(screen.getByRole('button', { name: /Worn \/ Recyclable/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Staff can only use bins at their site.',
    )
  })

  test('rejects an invalid weight without calling the API', async () => {
    render(<GarmentSortingWorkspace />)

    fireEvent.change(screen.getByLabelText(/Estimated Weight/i), { target: { value: '-2' } })
    fireEvent.click(screen.getByRole('button', { name: /Good \/ Reusable/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a weight of 0 kg or more')
    expect(api.sortGarment).not.toHaveBeenCalled()
  })

  test('shows a sealed recycling bin as ready for handoff', async () => {
    vi.spyOn(api, 'getBins').mockResolvedValue([
      {
        ...mockActiveBins.recycle_bin!,
        status: 'ready',
        ready_at: new Date().toISOString(),
      },
    ])
    render(<GarmentSortingWorkspace />)

    expect(await screen.findByText('Sealed / Ready for handoff')).toBeInTheDocument()
    expect(screen.getByText('Ready for handoff')).toBeInTheDocument()
  })

  test('does not load data or sort until a staff member is chosen', async () => {
    workspaceRef.current = workspaceFor(null)
    render(<GarmentSortingWorkspace />)

    expect(screen.getByRole('button', { name: /Good \/ Reusable/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Repair \/ Upcycle/i })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'u' })

    expect(api.getSortingStats).not.toHaveBeenCalled()
    expect(api.sortGarment).not.toHaveBeenCalled()
  })

  test('ignores held keys and browser shortcuts such as Cmd+C', async () => {
    render(<GarmentSortingWorkspace />)

    fireEvent.keyDown(window, { key: 'c', metaKey: true })
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'u', repeat: true })

    await waitFor(() => expect(api.getSortingStats).toHaveBeenCalled())
    expect(api.sortGarment).not.toHaveBeenCalled()
  })
})
