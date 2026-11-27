/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  approveHandoff,
  closeHandoff,
  getHandoffs,
  getSortingSites,
  type HandoffOutcomes,
  type HandoffRecord,
} from '@/api'
import { signInAs } from '@/test/auth'
import {
  chooseOption,
  handoffRecord,
  MANAGER_ID,
  stubRadixBrowserApis,
} from '@/test/handoff-fixtures'
import { RecycleBinRecordsPage } from './RecycleBinRecordsPage'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  approveHandoff: vi.fn(),
  closeHandoff: vi.fn(),
  getHandoffs: vi.fn(),
  getSortingSites: vi.fn(),
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

const disputed = handoffRecord({
  id: 1,
  bin_code: 'bin-disputed',
  status: 'disputed',
  driver_weight_kg: 42,
  weight_variance_percent: 5,
  requires_manager_approval: true,
})
const awaitingReport = handoffRecord({ id: 2, bin_code: 'bin-pending' })
const readyToClose = handoffRecord({ id: 3, bin_code: 'bin-ready', outcomes })
const otherSite = handoffRecord({ id: 4, bin_code: 'bin-other', site_id: 9 })

let records: HandoffRecord[]

function renderPage() {
  render(
    <MemoryRouter>
      <RecycleBinRecordsPage />
    </MemoryRouter>,
  )
}

async function waitForRecords() {
  await screen.findByText(/^Showing \d+ of \d+ records$/)
}

function card(binCode: string) {
  return screen.getByRole('heading', { name: `#${binCode}` }).closest('li')!
}

async function waitForDialogToClose() {
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
}

function binOrder() {
  return screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
}

beforeEach(() => {
  signInAs('manager', { id: MANAGER_ID })
  records = [disputed, awaitingReport, readyToClose, otherSite]
  vi.mocked(getSortingSites).mockResolvedValue([
    { id: 1, code: 'DASH-BKK', name: 'Bangkok Sorting Center' },
  ])
  vi.mocked(getHandoffs).mockImplementation(async () => ({ handoffs: [...records] }))
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.clearAllMocks()
})

test('shows only the records for the manager’s sites', async () => {
  renderPage()
  await waitForRecords()

  expect(getSortingSites).toHaveBeenCalledWith(MANAGER_ID)
  expect(screen.getByText('Showing 3 of 3 records')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '#bin-other' })).not.toBeInTheDocument()
})

test('offers approval only on disputed records', async () => {
  renderPage()
  await waitForRecords()

  expect(within(card('bin-disputed')).getByRole('button', { name: 'Approve' })).toBeEnabled()
  expect(
    within(card('bin-disputed')).queryByRole('button', { name: /Close Handoff/ }),
  ).not.toBeInTheDocument()
  expect(
    within(card('bin-pending')).queryByRole('button', { name: 'Approve' }),
  ).not.toBeInTheDocument()
})

test('approves a disputed record as the signed-in manager', async () => {
  vi.mocked(approveHandoff).mockResolvedValue({
    ...disputed,
    status: 'approved',
    approved_by: 'manager@example.com',
  })
  renderPage()
  await waitForRecords()

  fireEvent.click(within(card('bin-disputed')).getByRole('button', { name: 'Approve' }))
  const dialog = screen.getByRole('alertdialog')
  expect(within(dialog).getByText('5.00%')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
  await waitForDialogToClose()

  expect(await within(card('bin-disputed')).findByText('Approved')).toBeInTheDocument()
  expect(approveHandoff).toHaveBeenCalledWith(1, MANAGER_ID)
  expect(within(card('bin-disputed')).getByText('Approved by manager@example.com')).toBeVisible()
})

test('keeps Close disabled until the outcome report is in', async () => {
  renderPage()
  await waitForRecords()

  const pending = within(card('bin-pending'))
  expect(pending.getByRole('button', { name: /Close Handoff/ })).toBeDisabled()
  expect(pending.getByText(/Waiting for the contractor/)).toBeInTheDocument()
  expect(within(card('bin-ready')).getByRole('button', { name: /Close Handoff/ })).toBeEnabled()
})

test('closes a reported record after review', async () => {
  vi.mocked(closeHandoff).mockResolvedValue({
    ...readyToClose,
    status: 'closed',
    closed_at: '2026-11-27T04:00:00Z',
  })
  renderPage()
  await waitForRecords()

  fireEvent.click(within(card('bin-ready')).getByRole('button', { name: /Close Handoff/ }))
  const dialog = screen.getByRole('alertdialog')
  expect(within(dialog).getByText('39.0 kg')).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close Handoff' }))
  await waitForDialogToClose()

  expect(await within(card('bin-ready')).findByText('Closed')).toBeInTheDocument()
  expect(closeHandoff).toHaveBeenCalledWith(3, MANAGER_ID)
  expect(
    within(card('bin-ready')).queryByRole('button', { name: /Close Handoff/ }),
  ).not.toBeInTheDocument()
})

test('shows the API error when an action is refused', async () => {
  vi.mocked(closeHandoff).mockRejectedValue(
    new Error("The contractor's outcome report for this handoff is still pending."),
  )
  renderPage()
  await waitForRecords()

  fireEvent.click(within(card('bin-ready')).getByRole('button', { name: /Close Handoff/ }))
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close Handoff' }),
  )
  await waitForDialogToClose()

  expect(await within(card('bin-ready')).findByRole('alert')).toHaveTextContent(
    'outcome report for this handoff is still pending',
  )
})

test('filters by review stage', async () => {
  renderPage()
  await waitForRecords()

  chooseOption('Filtered by:', 'Needs Approval')
  expect(binOrder()).toEqual(['#bin-disputed'])
  chooseOption('Filtered by:', 'Ready to Close')
  expect(binOrder()).toEqual(['#bin-ready'])
  chooseOption('Filtered by:', 'Awaiting Report')
  expect(binOrder()).toEqual(['#bin-pending'])
  chooseOption('Filtered by:', 'Closed')
  expect(screen.getByText('No handoff records match this filter.')).toBeInTheDocument()
})

test('loads one site when a site is chosen', async () => {
  renderPage()
  await waitForRecords()

  chooseOption('Site:', 'Bangkok Sorting Center')
  await waitForRecords()
  expect(getHandoffs).toHaveBeenLastCalledWith({ site_id: 1 }, expect.any(AbortSignal))
})

test('loads nothing for a staff account', async () => {
  signInAs('staff')
  renderPage()

  expect(
    screen.getByText(
      'Recycle Bin Records is available to manager and administrator accounts only.',
    ),
  ).toBeInTheDocument()
  expect(getSortingSites).not.toHaveBeenCalled()
  expect(getHandoffs).not.toHaveBeenCalled()
})
