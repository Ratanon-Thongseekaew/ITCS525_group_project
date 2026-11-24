import { fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { HandoffOptions, HandoffReadyBin, HandoffRecord } from '@/types/handoff'

export const STAFF_ID = 10
export const MANAGER_ID = 11

export const handoffOptions: HandoffOptions = {
  sites: [
    { id: 1, code: 'DASH-BKK', name: 'Bangkok Sorting Center' },
    { id: 2, code: 'DASH-CNX', name: 'Chiang Mai Sorting Center' },
  ],
  contractors: [
    { id: 1, name: 'GreenLoop Recycling' },
    { id: 2, name: 'Circular Fibre Co.' },
  ],
  actors: [
    { id: STAFF_ID, username: 'staff.bkk@example.com', role: 'staff', site_ids: [1] },
    { id: MANAGER_ID, username: 'manager@example.com', role: 'manager', site_ids: [1, 2] },
  ],
}

export function readyBin(overrides: Partial<HandoffReadyBin> = {}): HandoffReadyBin {
  return {
    id: 1,
    site_id: 1,
    site_name: 'Bangkok Sorting Center',
    code: 'HAND-BKK-READY-01',
    item_count: 80,
    total_weight_kg: 40,
    ready_at: '2026-11-18T09:00:00Z',
    ...overrides,
  }
}

export function handoffRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 100,
    site_id: 1,
    site_name: 'Bangkok Sorting Center',
    bin_id: 1,
    bin_code: 'HAND-BKK-READY-01',
    item_count: 80,
    bin_weight_kg: 40,
    contractor_id: 1,
    contractor_name: 'GreenLoop Recycling',
    status: 'picked_up',
    scheduled_pickup_at: '2026-11-20T04:00:00Z',
    picked_up_at: '2026-11-20T04:00:00Z',
    staff_weight_kg: 40,
    driver_weight_kg: 40.5,
    weight_variance_percent: 1.25,
    requires_manager_approval: false,
    scale_photo_url: '/api/handoffs/100/scale-photo',
    driver_name: 'Somchai P.',
    vehicle_plate_number: '1KB-2345',
    created_by: 'staff.bkk@example.com',
    approved_by: null,
    approved_at: null,
    closed_at: null,
    outcomes: null,
    ...overrides,
  }
}

/** jsdom lacks these browser APIs, which Radix Select needs. */
export function stubRadixBrowserApis() {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
}

export function chooseOption(label: string | RegExp, option: string | RegExp) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: option }))
}

export function actAs(actorId: number) {
  window.localStorage.setItem('textile-track:handoff-actor-id', String(actorId))
}

export function scalePhoto(type = 'image/png', size = 64) {
  return new File([new Uint8Array(size)], 'scale.png', { type })
}

/** Fills in valid pickup evidence; the staff weight is prefilled from the bin. */
export function fillPickupEvidence({ driverWeight = '40.5', photo = scalePhoto() } = {}) {
  fireEvent.change(screen.getByLabelText('Driver Weight (kg)'), {
    target: { value: driverWeight },
  })
  fireEvent.change(screen.getByLabelText('Driver Name'), { target: { value: 'Somchai P.' } })
  fireEvent.change(screen.getByLabelText('Vehicle Plate Number'), {
    target: { value: '1KB-2345' },
  })
  fireEvent.change(screen.getByLabelText('Scale Photo'), { target: { files: [photo] } })
}
