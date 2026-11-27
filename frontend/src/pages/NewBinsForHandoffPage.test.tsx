/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  getHandoffOptions,
  getHandoffReadyBins,
  getHandoffs,
  recordHandoffAtPickup,
  type HandoffReadyBin,
} from '@/api'
import { signInAs } from '@/test/auth'
import {
  chooseOption,
  fillPickupEvidence,
  handoffOptions,
  handoffRecord,
  MANAGER_ID,
  readyBin,
  STAFF_ID,
  stubRadixBrowserApis,
} from '@/test/handoff-fixtures'
import { NewBinsForHandoffPage } from './NewBinsForHandoffPage'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  getHandoffOptions: vi.fn(),
  getHandoffReadyBins: vi.fn(),
  getHandoffs: vi.fn(),
  recordHandoffAtPickup: vi.fn(),
}))

stubRadixBrowserApis()

// Local times, so the expected text doesn't depend on the test machine's timezone.
const packedAt = new Date(2026, 9, 1, 15, 30).toISOString()

let bins: HandoffReadyBin[]

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

async function findBinList() {
  await screen.findByRole('heading', { name: `#${bins[0]?.code ?? 'none'}` })
}

beforeEach(() => {
  signInAs('staff', { id: STAFF_ID })
  bins = [
    readyBin({ id: 1, code: 'test-001', item_count: 10, total_weight_kg: 1.5, ready_at: packedAt }),
    readyBin({ id: 2, code: 'test-002', item_count: 25, total_weight_kg: 0.1, ready_at: packedAt }),
    readyBin({ id: 3, code: 'test-003', item_count: 7, total_weight_kg: 0.2, ready_at: packedAt }),
  ]
  vi.mocked(getHandoffOptions).mockResolvedValue(handoffOptions)
  vi.mocked(getHandoffReadyBins).mockImplementation(async () => ({ bins: [...bins] }))
  vi.mocked(getHandoffs).mockResolvedValue({
    handoffs: [handoffRecord({ id: 50, status: 'disputed' })],
  })
  vi.mocked(recordHandoffAtPickup).mockReset()
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.clearAllMocks()
})

test('loads the ready bins and summary for the staff member’s site', async () => {
  renderPage()
  await findBinList()

  expect(getHandoffReadyBins).toHaveBeenCalledWith('test-token', 1, expect.any(AbortSignal))
  expect(getHandoffs).toHaveBeenCalledWith(
    'test-token',
    { status: 'disputed', site_id: 1 },
    expect.any(AbortSignal),
  )
  expect(metricValue('Bins Awaiting')).toHaveTextContent('3')
  expect(metricValue('Items Staged')).toHaveTextContent('42')
  expect(metricValue('Total Grossed Weight')).toHaveTextContent('1.8 kg')
  expect(metricValue('Awaiting Approval')).toHaveTextContent('1')
  expect(screen.getByRole('link', { name: 'Review in Handoff Records' })).toHaveAttribute(
    'href',
    '/staff/recycle-bin-handoff/handoff-records',
  )
  expect(screen.getByText('Showing 3 of 3 records')).toBeInTheDocument()
})

test('shows each bin with its own details', async () => {
  renderPage()
  await findBinList()

  const binList = screen.getByRole('list', { name: 'Bins awaiting handoff' })
  const card = within(binList).getAllByRole('listitem')[1]

  expect(within(card).getByRole('heading', { name: '#test-002' })).toBeInTheDocument()
  expect(within(card).getByText('Recycling Bin · Bangkok Sorting Center')).toBeInTheDocument()
  expect(within(card).getByText('Packed at 3:30 PM, 1 OCT 2026')).toBeInTheDocument()
  expect(within(card).getByText('Item count').nextElementSibling).toHaveTextContent('25 items')
  expect(within(card).getByText('Grossed Weight').nextElementSibling).toHaveTextContent('0.1kg')
  expect(within(card).getByText('Awaiting Handoff')).toBeInTheDocument()
})

test('shows empty states when nothing is waiting or disputed', async () => {
  bins = []
  vi.mocked(getHandoffs).mockResolvedValue({ handoffs: [] })

  renderPage()

  expect(await screen.findByText('No bins awaiting handoff.')).toBeInTheDocument()
  expect(metricValue('Bins Awaiting')).toHaveTextContent('0')
  expect(metricValue('Total Grossed Weight')).toHaveTextContent('0 kg')
  expect(metricValue('Awaiting Approval')).toHaveTextContent('0')
  expect(screen.queryByRole('link', { name: 'Review in Handoff Records' })).not.toBeInTheDocument()
  expect(screen.getByText('Showing 0 of 0 records')).toBeInTheDocument()
})

test('shows a load error and retries', async () => {
  vi.mocked(getHandoffReadyBins).mockRejectedValueOnce(new Error('Server unavailable'))

  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await findBinList()
})

test('uses the signed-in staff account and its store instead of a picker', async () => {
  renderPage()
  await findBinList()

  const account = screen.getByRole('group', { name: 'Signed-in staff account' })
  expect(account).toHaveTextContent('Test staff')
  expect(account).toHaveTextContent('Siam Square')
  expect(screen.queryByLabelText('Staff member')).not.toBeInTheDocument()
  expect(screen.queryByText(/Temporary/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '#test-001' })).toBeEnabled()
})

test('loads nothing for a staff account without a store', async () => {
  signInAs('staff', { id: STAFF_ID, store: null })
  renderPage()

  expect(
    await screen.findByText(
      'A staff account assigned to a store is required to load bins awaiting handoff.',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Signed-in staff account' })).toHaveTextContent(
    'No store assigned',
  )
  expect(getHandoffReadyBins).not.toHaveBeenCalled()
})

test('loads nothing for a signed-in manager', async () => {
  signInAs('manager', { id: MANAGER_ID })
  renderPage()

  expect(
    await screen.findByText('Recycle Bin Handoff is available to staff accounts only.'),
  ).toBeInTheDocument()
  expect(getHandoffReadyBins).not.toHaveBeenCalled()
  expect(getHandoffOptions).not.toHaveBeenCalled()
})

test('links to Handoff Records and has no scheduling page', () => {
  renderPage()

  expect(screen.getByRole('link', { name: 'Handoff Records' })).toHaveAttribute(
    'href',
    '/staff/recycle-bin-handoff/handoff-records',
  )
  expect(screen.queryByRole('link', { name: /Scheduled Pickup/ })).not.toBeInTheDocument()
})

function openDialog(binCode: string) {
  fireEvent.click(screen.getByRole('button', { name: `#${binCode}` }))
  return screen.getByRole('dialog', { name: 'New Handoff Record' })
}

test('returns focus to the bin when the dialog closes without saving', async () => {
  renderPage()
  await findBinList()

  const binButton = screen.getByRole('button', { name: '#test-002' })
  binButton.focus()
  fireEvent.click(binButton)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(metricValue('Bins Awaiting')).toHaveTextContent('3')
  await waitFor(() => expect(binButton).toHaveFocus())
})

test('records the handoff, removes the bin, and updates the summary', async () => {
  vi.mocked(recordHandoffAtPickup).mockResolvedValue(
    handoffRecord({ bin_id: 2, bin_code: 'test-002' }),
  )
  renderPage()
  await findBinList()

  const dialog = openDialog('test-002')
  expect(within(dialog).getByText('#test-002')).toBeInTheDocument()
  chooseOption('Contractor', 'GreenLoop Recycling')
  fillPickupEvidence({ driverWeight: '0.1' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Handoff' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(recordHandoffAtPickup).toHaveBeenCalledWith(
    'test-token',
    expect.objectContaining({ bin_id: 2, contractor_id: 1 }),
  )
  expect(vi.mocked(recordHandoffAtPickup).mock.calls[0][1]).not.toHaveProperty('actor_id')
  expect(screen.queryByRole('heading', { name: '#test-002' })).not.toBeInTheDocument()
  expect(metricValue('Bins Awaiting')).toHaveTextContent('2')
  expect(metricValue('Items Staged')).toHaveTextContent('17')
  expect(metricValue('Total Grossed Weight')).toHaveTextContent('1.7 kg')
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Bins awaiting handoff' })).toHaveFocus(),
  )
})

test('counts a new disputed handoff as awaiting approval', async () => {
  vi.mocked(recordHandoffAtPickup).mockResolvedValue(
    handoffRecord({ bin_id: 1, bin_code: 'test-001', status: 'disputed' }),
  )
  renderPage()
  await findBinList()
  expect(metricValue('Awaiting Approval')).toHaveTextContent('1')

  const dialog = openDialog('test-001')
  chooseOption('Contractor', 'GreenLoop Recycling')
  fillPickupEvidence({ driverWeight: '2' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Handoff' }))

  await waitFor(() => expect(metricValue('Awaiting Approval')).toHaveTextContent('2'))
})
