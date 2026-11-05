/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { HandoffBin } from '@/types/handoff'
import { NewBinsForHandoffPage } from './NewBinsForHandoffPage'

const mockData = vi.hoisted(() => ({
  bins: [] as HandoffBin[],
  pickup: null as string | null,
}))

vi.mock('@/lib/mock-handoff-bins', () => ({
  get newHandoffBins() {
    return mockData.bins
  },
  get nextScheduledPickup() {
    return mockData.pickup
  },
}))

function createBin(overrides: Partial<HandoffBin> = {}): HandoffBin {
  return {
    id: 'test-1',
    bin_code: 'test-001',
    bin_type: 'recycle',
    status: 'awaiting_handoff',
    item_count: 10,
    total_weight_kg: 1.5,
    packed_at: '2026-10-01T15:30:00',
    ...overrides,
  }
}

function renderPage() {
  render(
    <MemoryRouter>
      <NewBinsForHandoffPage />
    </MemoryRouter>,
  )
}

function metricValue(label: string) {
  return screen.getByText(label).nextElementSibling
}

beforeEach(() => {
  mockData.bins = [
    createBin(),
    createBin({ id: 'test-2', bin_code: 'test-002', item_count: 25, total_weight_kg: 0.1 }),
    createBin({ id: 'test-3', bin_code: 'test-003', item_count: 7, total_weight_kg: 0.2 }),
  ]
  mockData.pickup = '2026-12-03T09:00:00'
})

afterEach(() => {
  cleanup()
})

test('calculates the summary from the bin list', () => {
  renderPage()

  expect(metricValue('Bins Awaiting')).toHaveTextContent('3')
  expect(metricValue('Items Staged')).toHaveTextContent('42')
  expect(metricValue('Total Grossed Weight')).toHaveTextContent('1.8 kg')
  expect(metricValue('Next Scheduled Pickup')).toHaveTextContent('3 Dec 2026')
})

test('shows each bin with its own details', () => {
  renderPage()

  const card = screen.getAllByRole('listitem')[1]

  expect(within(card).getByRole('heading', { name: '#test-002' })).toBeInTheDocument()
  expect(within(card).getByText('Recycling Bin')).toBeInTheDocument()
  expect(within(card).getByText('Packed at 3:30 PM, 1 OCT 2026')).toBeInTheDocument()
  expect(within(card).getByText('Item count').nextElementSibling).toHaveTextContent('25 items')
  expect(within(card).getByText('Grossed Weight').nextElementSibling).toHaveTextContent('0.1kg')
  expect(within(card).getByText('Awaiting Handoff')).toBeInTheDocument()
})

test('formats times just after midnight', () => {
  mockData.bins = [createBin({ packed_at: '2026-10-01T00:30:00' })]

  renderPage()

  expect(screen.getByText('Packed at 12:30 AM, 1 OCT 2026')).toBeInTheDocument()
})

test('counts the records shown', () => {
  renderPage()

  expect(screen.getAllByRole('listitem')).toHaveLength(3)
  expect(screen.getByText('Showing 3 of 3 records')).toBeInTheDocument()
})

test('shows an empty state when no bins are awaiting handoff', () => {
  mockData.bins = []

  renderPage()

  expect(screen.getByText('No bins awaiting handoff.')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  expect(metricValue('Bins Awaiting')).toHaveTextContent('0')
  expect(metricValue('Items Staged')).toHaveTextContent('0')
  expect(metricValue('Total Grossed Weight')).toHaveTextContent('0 kg')
  expect(screen.getByText('Showing 0 of 0 records')).toBeInTheDocument()
})

test('shows a dash when no pickup is scheduled', () => {
  mockData.pickup = null

  renderPage()

  expect(metricValue('Next Scheduled Pickup')).toHaveTextContent('—')
})

test.each([
  ['Scheduled Pickup Dates', '/staff/recycle-bin-handoff/pickup-dates'],
  ['Handoff Records', '/staff/recycle-bin-handoff/records'],
])('links %s to its page', (label, href) => {
  renderPage()

  expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
})
