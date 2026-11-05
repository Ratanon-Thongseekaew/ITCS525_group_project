/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { HandoffRecord, MaterialOutcomes } from '@/types/handoff'
import { HandoffRecordsPage } from './HandoffRecordsPage'

const mockData = vi.hoisted(() => ({
  records: [] as HandoffRecord[],
}))

vi.mock('@/lib/mock-handoff-records', () => ({
  get handoffRecords() {
    return mockData.records
  },
}))

// jsdom lacks these browser APIs, which Radix Select needs.
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

const outcomes: MaterialOutcomes = {
  upcycled_kg: 5,
  recycled_to_fiber_kg: 15,
  downcycled_kg: 10,
  exported_overseas_kg: 5,
  landfill_kg: 4,
}

function createCollected(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 'test-1',
    bin_code: 'test-001',
    contractor: { id: 'c2', name: 'Contractor 2' },
    collected_at: '2026-10-20T18:30:00',
    item_count: 100,
    recorded_weight_kg: 40,
    status: 'collected',
    outcomes: null,
    ...overrides,
  } as HandoffRecord
}

function createReceived(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 'test-2',
    bin_code: 'test-002',
    contractor: { id: 'c1', name: 'Contractor 1' },
    collected_at: '2026-10-16T18:00:00',
    item_count: 80,
    recorded_weight_kg: 40,
    status: 'outcomes_received',
    outcomes,
    ...overrides,
  } as HandoffRecord
}

function renderPage() {
  render(
    <MemoryRouter>
      <HandoffRecordsPage />
    </MemoryRouter>,
  )
}

function selectOption(label: string, option: string) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: option }))
}

function binOrder() {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
}

function outcomeValue(label: string) {
  return screen.getByText(label).nextElementSibling
}

beforeEach(() => {
  mockData.records = [createCollected(), createReceived()]
})

afterEach(() => {
  cleanup()
})

test('shows a collected record with its details and the pending notice', () => {
  mockData.records = [createCollected()]

  renderPage()

  const card = screen.getByRole('listitem')

  expect(within(card).getByRole('heading', { name: '#test-001' })).toBeInTheDocument()
  expect(within(card).getByText('Contractor 2')).toBeInTheDocument()
  expect(within(card).getByText('20 OCT 2026, 6:30 PM')).toBeInTheDocument()
  expect(within(card).getByText('Item count').nextElementSibling).toHaveTextContent('100 items')
  expect(within(card).getByText('Recorded Weight').nextElementSibling).toHaveTextContent('40.0kg')
  expect(within(card).getByText('Status').nextElementSibling).toHaveTextContent('Collected')
  expect(within(card).getByText('Outcome report is still pending!')).toBeInTheDocument()
  expect(within(card).queryByText('Material outcomes')).not.toBeInTheDocument()
})

test('shows a received record with its material outcomes and no pending notice', () => {
  mockData.records = [createReceived()]

  renderPage()

  expect(screen.getByText('Status').nextElementSibling).toHaveTextContent('Outcomes Received')
  expect(screen.getByRole('heading', { name: 'Material outcomes' })).toBeInTheDocument()
  expect(screen.getByText('WEIGHT / kg')).toBeInTheDocument()
  expect(outcomeValue('Upcycled')).toHaveTextContent('5.0 kg')
  expect(outcomeValue('Recycled to Fiber')).toHaveTextContent('15.0 kg')
  expect(outcomeValue('Downcycled')).toHaveTextContent('10.0 kg')
  expect(outcomeValue('Exported Overseas')).toHaveTextContent('5.0 kg')
  expect(outcomeValue('Sent to landfill')).toHaveTextContent('4.0 kg')
  expect(screen.queryByText('Outcome report is still pending!')).not.toBeInTheDocument()
})

test('calculates the total reported and a negative variance', () => {
  mockData.records = [createReceived()]

  renderPage()

  expect(outcomeValue('Total Reported')).toHaveTextContent('39.0 kg')
  expect(outcomeValue('Variance')).toHaveTextContent('-1.0 kg')
})

test('marks a positive variance with a plus sign', () => {
  mockData.records = [createReceived({ recorded_weight_kg: 38 })]

  renderPage()

  expect(outcomeValue('Variance')).toHaveTextContent('+1.0 kg')
})

test('shows a matching weight as zero variance', () => {
  mockData.records = [createReceived({ recorded_weight_kg: 39 })]

  renderPage()

  expect(outcomeValue('Variance')).toHaveTextContent(/^0\.0 kg$/)
})

test('does not show floating-point noise or a negative zero', () => {
  mockData.records = [
    createReceived({
      recorded_weight_kg: 0.34,
      outcomes: {
        upcycled_kg: 0.1,
        recycled_to_fiber_kg: 0.2,
        downcycled_kg: 0,
        exported_overseas_kg: 0,
        landfill_kg: 0,
      },
    }),
  ]

  renderPage()

  expect(outcomeValue('Total Reported')).toHaveTextContent(/^0\.3 kg$/)
  expect(outcomeValue('Variance')).toHaveTextContent(/^0\.0 kg$/)
})

test('formats collection times just after midnight', () => {
  mockData.records = [createCollected({ collected_at: '2026-10-01T00:30:00' })]

  renderPage()

  expect(screen.getByText('1 OCT 2026, 12:30 AM')).toBeInTheDocument()
})

test('starts with all records, sorted by date with the newest first', () => {
  mockData.records = [createReceived(), createCollected()]

  renderPage()

  expect(screen.getByLabelText('Filtered by:')).toHaveTextContent('All')
  expect(screen.getByLabelText('Sort by:')).toHaveTextContent('Date')
  expect(binOrder()).toEqual(['#test-001', '#test-002'])
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test.each([
  ['Collected', '#test-001'],
  ['Outcomes Received', '#test-002'],
])('filters the list to %s records', (option, binCode) => {
  renderPage()

  selectOption('Filtered by:', option)

  expect(binOrder()).toEqual([binCode])
  expect(screen.getByText('Showing 1 of 2 records')).toBeInTheDocument()
})

test('shows every record again when the filter returns to All', () => {
  renderPage()

  selectOption('Filtered by:', 'Collected')
  selectOption('Filtered by:', 'All')

  expect(binOrder()).toHaveLength(2)
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test('sorts by bin ID in natural order', () => {
  mockData.records = [
    createCollected({ id: 'a', bin_code: 'bin-10' }),
    createCollected({ id: 'b', bin_code: 'bin-9' }),
  ]

  renderPage()

  selectOption('Sort by:', 'Bin ID')

  expect(binOrder()).toEqual(['#bin-9', '#bin-10'])
})

test('sorts by recorded weight with the heaviest first', () => {
  mockData.records = [
    createCollected({ id: 'a', bin_code: 'light', recorded_weight_kg: 10 }),
    createCollected({ id: 'b', bin_code: 'heavy', recorded_weight_kg: 50 }),
  ]

  renderPage()

  selectOption('Sort by:', 'Recorded Weight')

  expect(binOrder()).toEqual(['#heavy', '#light'])
})

test('keeps the sort when the filter changes', () => {
  mockData.records = [
    createCollected({ id: 'a', bin_code: 'light', recorded_weight_kg: 10 }),
    createCollected({ id: 'b', bin_code: 'heavy', recorded_weight_kg: 50 }),
    createReceived(),
  ]

  renderPage()

  selectOption('Sort by:', 'Recorded Weight')
  selectOption('Filtered by:', 'Collected')

  expect(binOrder()).toEqual(['#heavy', '#light'])
})

test('does not reorder the source records', () => {
  mockData.records = [createReceived(), createCollected()]
  const original = [...mockData.records]

  renderPage()

  expect(mockData.records).toEqual(original)
})

test('shows an empty state when the filter matches nothing', () => {
  mockData.records = [createCollected()]

  renderPage()

  selectOption('Filtered by:', 'Outcomes Received')

  expect(screen.getByText('No handoff records match this filter.')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  expect(screen.getByText('Showing 0 of 1 records')).toBeInTheDocument()
})

test('shows an empty state when there are no records', () => {
  mockData.records = []

  renderPage()

  expect(screen.getByText('No handoff records yet.')).toBeInTheDocument()
  expect(screen.getByText('Showing 0 of 0 records')).toBeInTheDocument()
})

test('links back to the handoff page', () => {
  renderPage()

  expect(screen.getByRole('link', { name: 'Back to Handoff' })).toHaveAttribute(
    'href',
    '/staff/recycle-bin-handoff',
  )
})
