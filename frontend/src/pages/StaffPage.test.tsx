/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as api from '../api'
import { StaffPage } from './StaffPage'

describe('StaffPage - Garment Sorting & Bin Records (Feature 2)', () => {
  const mockStats: api.SortingStatsResponse = {
    total_sorted_today: 36,
    resale_count: 14,
    recycle_count: 22,
    resale_percentage: 38.9,
    active_resale_bin_code: 'BIN-RS-001',
    active_resale_bin_items: 14,
    active_recycle_bin_code: 'BIN-RC-001',
    active_recycle_bin_items: 22,
  }

  const mockActiveBins: api.ActiveBinsResponse = {
    resale_bin: {
      id: 'bin-rs-001',
      bin_code: 'BIN-RS-001',
      bin_type: 'resale',
      status: 'active',
      item_count: 14,
      total_weight_kg: 5.2,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      closed_at: null,
      notes: 'Active counter bin',
    },
    recycle_bin: {
      id: 'bin-rc-001',
      bin_code: 'BIN-RC-001',
      bin_type: 'recycle',
      status: 'active',
      item_count: 22,
      total_weight_kg: 8.4,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      closed_at: null,
      notes: 'Active recycle bin',
    },
  }

  const mockBins: api.BinRecord[] = [
    mockActiveBins.resale_bin!,
    mockActiveBins.recycle_bin!,
    {
      id: 'bin-rs-000',
      bin_code: 'BIN-RS-000',
      bin_type: 'resale',
      status: 'closed',
      item_count: 50,
      total_weight_kg: 18.5,
      max_capacity: 50,
      created_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      notes: 'Completed batch',
    },
  ]

  const mockRecentGarments: api.GarmentItem[] = [
    {
      id: 'gmt-001',
      condition: 'good_reusable',
      category: 'Tops',
      bin_id: 'bin-rs-001',
      bin_code: 'BIN-RS-001',
      weight_kg: 0.35,
      notes: null,
      created_at: new Date().toISOString(),
    },
  ]

  beforeEach(() => {
    vi.spyOn(api, 'getSortingStats').mockResolvedValue(mockStats)
    vi.spyOn(api, 'getActiveBins').mockResolvedValue(mockActiveBins)
    vi.spyOn(api, 'getBins').mockResolvedValue(mockBins)
    vi.spyOn(api, 'getRecentGarments').mockResolvedValue(mockRecentGarments)
    vi.spyOn(api, 'sortGarment').mockResolvedValue({
      garment: {
        id: 'gmt-002',
        condition: 'good_reusable',
        category: 'Tops',
        bin_id: 'bin-rs-001',
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
      id: 'bin-rs-002',
      bin_code: 'BIN-RS-002',
      bin_type: 'resale',
      status: 'active',
      item_count: 0,
      total_weight_kg: 0,
      max_capacity: 50,
      created_at: new Date().toISOString(),
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
    render(<StaffPage />)

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
  })

  test('handles quick-tap sorting to direct resale', async () => {
    render(<StaffPage />)

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
    render(<StaffPage />)

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
    render(<StaffPage />)

    const newBinBtn = screen.getByRole('button', { name: /New Bin Record/i })
    fireEvent.click(newBinBtn)

    expect(screen.getByText('Create New Bin Record')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.queryByText('Create New Bin Record')).not.toBeInTheDocument()
  })

  test('responds to keyboard shortcut for quick intake', async () => {
    render(<StaffPage />)

    fireEvent.keyDown(window, { key: 'r' })

    await waitFor(() => {
      expect(api.sortGarment).toHaveBeenCalledWith(
        expect.objectContaining({
          condition: 'good_reusable',
        }),
      )
    })
  })
})
