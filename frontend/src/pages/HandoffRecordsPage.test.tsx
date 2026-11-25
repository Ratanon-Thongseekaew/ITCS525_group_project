/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getHandoffOptions, getHandoffs, type HandoffOutcomes, type HandoffRecord } from '@/api'
import {
  actAs,
  chooseOption,
  handoffOptions,
  handoffRecord,
  STAFF_ID,
  stubRadixBrowserApis,
} from '@/test/handoff-fixtures'
import { HandoffRecordsPage } from './HandoffRecordsPage'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getHandoffOptions: vi.fn(),
  getHandoffs: vi.fn(),
}))

stubRadixBrowserApis()

const outcomes: HandoffOutcomes = {
  upcycled_weight_kg: 5,
  fibre_to_fibre_weight_kg: 15,
  downcycled_weight_kg: 10,
  exported_weight_kg: 5,
  landfilled_weight_kg: 3,
  incinerated_energy_recovery_weight_kg: 1,
}

// Local times, so the expected text doesn't depend on the test machine's timezone.
const october20 = new Date(2026, 9, 20, 18, 30).toISOString()
const october16 = new Date(2026, 9, 16, 18, 0).toISOString()

let records: HandoffRecord[]

function pickedUp(overrides: Partial<HandoffRecord> = {}) {
  return handoffRecord({
    id: 1,
    bin_code: 'test-001',
    contractor_name: 'Contractor 2',
    picked_up_at: october20,
    scheduled_pickup_at: october20,
    item_count: 100,
    staff_weight_kg: 40,
    driver_weight_kg: 40.5,
    weight_variance_percent: 1.25,
    ...overrides,
  })
}

function reported(overrides: Partial<HandoffRecord> = {}) {
  return pickedUp({
    id: 2,
    bin_code: 'test-002',
    contractor_name: 'Contractor 1',
    picked_up_at: october16,
    status: 'closed',
    outcomes,
    ...overrides,
  })
}

function renderPage() {
  render(
    <MemoryRouter>
      <HandoffRecordsPage />
    </MemoryRouter>,
  )
}

async function waitForRecords() {
  await screen.findByText(/^Showing \d+ of \d+ records$/)
}

function binOrder() {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
}

function outcomeValue(label: string) {
  return screen.getByText(label).nextElementSibling
}

beforeEach(() => {
  window.localStorage.clear()
  actAs(STAFF_ID)
  records = [pickedUp(), reported()]
  vi.mocked(getHandoffOptions).mockResolvedValue(handoffOptions)
  vi.mocked(getHandoffs).mockImplementation(async () => ({ handoffs: [...records] }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('loads the records for the staff member’s site', async () => {
  renderPage()
  await waitForRecords()

  expect(getHandoffs).toHaveBeenCalledWith({ site_id: 1 }, expect.any(AbortSignal))
})

test('shows the pickup evidence and the pending outcome notice', async () => {
  records = [pickedUp()]
  renderPage()
  await waitForRecords()

  const card = within(screen.getByRole('list', { name: 'Handoff records' })).getByRole('listitem')
  expect(within(card).getByRole('heading', { name: '#test-001' })).toBeInTheDocument()
  expect(within(card).getByText('Contractor 2')).toBeInTheDocument()
  expect(within(card).getByText('20 OCT 2026, 6:30 PM')).toBeInTheDocument()
  expect(within(card).getByText('Staff Weight').nextElementSibling).toHaveTextContent('40.0kg')
  expect(within(card).getByText('Driver Weight').nextElementSibling).toHaveTextContent('40.5kg')
  expect(within(card).getByText('Difference').nextElementSibling).toHaveTextContent(
    '0.5 kg (1.25%)',
  )
  expect(within(card).getByText('Status').nextElementSibling).toHaveTextContent('Picked Up')
  expect(within(card).getByText('Somchai P.')).toBeInTheDocument()
  expect(within(card).getByRole('link', { name: /View scale photo/ })).toHaveAttribute(
    'href',
    '/api/handoffs/100/scale-photo',
  )
  expect(within(card).getByText('Outcome report is still pending!')).toBeInTheDocument()
})

test('shows the weight difference in kg and as a percentage of the staff weight', async () => {
  records = [
    pickedUp({ staff_weight_kg: 41, driver_weight_kg: 42.8, weight_variance_percent: 4.3902 }),
  ]
  renderPage()
  await waitForRecords()

  expect(screen.getByText('Difference').nextElementSibling).toHaveTextContent('1.8 kg (4.39%)')
})

test.each([
  [null, 'Picked Up'],
  ['manager@example.com', 'Approved'],
])(
  'does not show Closed while the outcome report is pending (approved by %s)',
  async (approvedBy, label) => {
    records = [pickedUp({ status: 'closed', outcomes: null, approved_by: approvedBy })]
    renderPage()
    await waitForRecords()

    expect(screen.getByText('Status').nextElementSibling).toHaveTextContent(label)
    expect(screen.getByText('Outcome report is still pending!')).toBeInTheDocument()

    chooseOption('Filtered by:', 'Closed')
    expect(screen.getByText('No handoff records match this filter.')).toBeInTheDocument()
  },
)

test('shows all six material outcomes with the total and variance', async () => {
  records = [reported()]
  renderPage()
  await waitForRecords()

  expect(outcomeValue('Upcycled')).toHaveTextContent('5.0 kg')
  expect(outcomeValue('Fibre to Fibre')).toHaveTextContent('15.0 kg')
  expect(outcomeValue('Downcycled')).toHaveTextContent('10.0 kg')
  expect(outcomeValue('Exported')).toHaveTextContent('5.0 kg')
  expect(outcomeValue('Landfilled')).toHaveTextContent('3.0 kg')
  expect(outcomeValue('Incinerated (Energy Recovery)')).toHaveTextContent('1.0 kg')
  expect(outcomeValue('Total Reported')).toHaveTextContent('39.0 kg')
  expect(outcomeValue('Variance')).toHaveTextContent('-1.0 kg')
  expect(screen.queryByText('Outcome report is still pending!')).not.toBeInTheDocument()
})

test('does not show floating-point noise or a negative zero', async () => {
  records = [
    reported({
      staff_weight_kg: 0.34,
      outcomes: {
        upcycled_weight_kg: 0.1,
        fibre_to_fibre_weight_kg: 0.2,
        downcycled_weight_kg: 0,
        exported_weight_kg: 0,
        landfilled_weight_kg: 0,
        incinerated_energy_recovery_weight_kg: 0,
      },
    }),
  ]
  renderPage()
  await waitForRecords()

  expect(outcomeValue('Total Reported')).toHaveTextContent(/^0\.3 kg$/)
  expect(outcomeValue('Variance')).toHaveTextContent(/^0\.0 kg$/)
})

test('starts with all records, newest first, and filters by status', async () => {
  renderPage()
  await waitForRecords()

  expect(screen.getByLabelText('Filtered by:')).toHaveTextContent('All')
  expect(binOrder()).toEqual(['#test-001', '#test-002'])

  chooseOption('Filtered by:', 'Closed')
  expect(binOrder()).toEqual(['#test-002'])
  expect(screen.getByText('Showing 1 of 2 records')).toBeInTheDocument()

  chooseOption('Filtered by:', 'All')
  expect(binOrder()).toHaveLength(2)
})

test('sorts by bin ID in natural order and by recorded weight', async () => {
  records = [
    pickedUp({ id: 1, bin_code: 'bin-10', staff_weight_kg: 10 }),
    pickedUp({ id: 2, bin_code: 'bin-9', staff_weight_kg: 50 }),
  ]
  renderPage()
  await waitForRecords()

  chooseOption('Sort by:', 'Bin ID')
  expect(binOrder()).toEqual(['#bin-9', '#bin-10'])

  chooseOption('Sort by:', 'Recorded Weight')
  expect(binOrder()).toEqual(['#bin-9', '#bin-10'])
})

test('explains a disputed handoff without offering approval or closing', async () => {
  records = [pickedUp({ status: 'disputed', weight_variance_percent: 5 })]
  renderPage()
  await waitForRecords()

  expect(screen.getByText(/waiting for manager approval/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Close Handoff/ })).not.toBeInTheDocument()
})

test('loads nothing until a staff account is chosen', async () => {
  window.localStorage.clear()
  renderPage()

  expect(
    await screen.findByText('Choose your staff account above to see your site’s handoff records.'),
  ).toBeInTheDocument()
  expect(getHandoffs).not.toHaveBeenCalled()
})

test('shows a load error and retries', async () => {
  vi.mocked(getHandoffs).mockRejectedValueOnce(new Error('Server unavailable'))
  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitForRecords()
})
