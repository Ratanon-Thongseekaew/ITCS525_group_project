/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  getDashboard,
  getEprManagement,
  getEprQuarterReport,
  submitEprQuarter,
  type EprManagement,
} from '@/api'
import { dashboardFixture } from '@/test/dashboard-fixture'

import { ComplianceDashboardPage } from './ComplianceDashboardPage'
import { EprReportPrintPage } from './EprReportPrintPage'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return {
    ...original,
    getDashboard: vi.fn(),
    getEprQuarterReport: vi.fn(),
    getEprManagement: vi.fn(),
    submitEprQuarter: vi.fn(),
  }
})

const getDashboardMock = vi.mocked(getDashboard)
const getEprReportMock = vi.mocked(getEprQuarterReport)

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderDashboard() {
  render(
    <MemoryRouter initialEntries={['/manager/compliance-dashboard']}>
      <Routes>
        <Route path="manager/compliance-dashboard" element={<ComplianceDashboardPage />} />
        <Route path="manager/epr-report/print" element={<EprReportPrintPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('loads and renders dashboard data from the API', async () => {
  getDashboardMock.mockResolvedValue(dashboardFixture)

  renderDashboard()

  expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
  expect(await screen.findByText('Live data from the Textile Track database.')).toBeInTheDocument()
  expect(screen.getByText('October 2026')).toBeInTheDocument()
  expect(screen.getByText('DASH-BKK-2026-10-RECYCLE')).toBeInTheDocument()
  expect(screen.getAllByText('95%')).not.toHaveLength(0)
  expect(screen.getByRole('combobox', { name: 'Contractor' })).toHaveClass('overflow-hidden')
  expect(screen.getByRole('combobox', { name: 'Contractor' })).toHaveAttribute(
    'title',
    'All Contractors',
  )
  expect(getDashboardMock).toHaveBeenCalledWith(
    expect.objectContaining({ frequency: 'monthly' }),
    expect.any(AbortSignal),
  )
})

test('exports the same quarterly EPR figures to CSV and the printable page', async () => {
  getDashboardMock.mockResolvedValue(dashboardFixture)
  getEprReportMock.mockImplementation(async (year, quarter) => ({
    year,
    quarter,
    source: 'live_records',
    total_weight_received_kg: 100,
    resold_weight_kg: 10,
    repaired_weight_kg: 5,
    upcycled_weight_kg: 10,
    fibre_to_fibre_weight_kg: 10,
    downcycled_weight_kg: 10,
    exported_weight_kg: 10,
    landfilled_weight_kg: 20,
    incinerated_energy_recovery_weight_kg: 15,
    uncategorized_weight_kg: 10,
    excess_weight_kg: 0,
    recovery_rate_percent: 70,
    garments_missing_weight: 0,
  }))
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:epr')
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL: vi.fn() }),
  )
  const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})

  renderDashboard()
  await screen.findByText('Live data from the Textile Track database.')
  const exportButton = screen.getByRole('button', { name: 'Export EPR Report' })
  expect(exportButton).toHaveClass('cursor-pointer', 'hover:bg-teal-800')
  fireEvent.click(exportButton)
  const exportDialog = screen.getByRole('dialog', { name: 'Export quarterly EPR report' })
  expect(exportDialog).toHaveClass('bg-white', 'text-slate-900')
  const dialog = within(exportDialog)
  const printLink = await dialog.findByRole('link', { name: 'Open printable report' })
  expect(printLink).toHaveAttribute(
    'href',
    expect.stringMatching(/^\/manager\/epr-report\/print\?/),
  )
  const downloadButton = dialog.getByRole('button', { name: 'Download CSV' })
  expect(downloadButton).toHaveClass('cursor-pointer', 'hover:bg-slate-100')
  fireEvent.click(downloadButton)
  expect(download).toHaveBeenCalledOnce()

  const blob = createObjectURL.mock.calls[0][0]
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
  expect(csv).toContain('"Incinerated with energy recovery","15","kg"')
  expect(csv).toContain('"Landfilled","20","kg"')
  expect(csv).toContain('"Recovery rate","70","%"')

  fireEvent.click(printLink)
  expect(await screen.findByRole('heading', { name: 'Quarterly EPR report' })).toBeInTheDocument()
  expect(screen.getByRole('row', { name: 'Recovery rate 70%' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to Compliance Dashboard' })).toHaveAttribute(
    'href',
    '/manager/compliance-dashboard',
  )
  const printButton = screen.getByRole('button', { name: 'Print report' })
  expect(printButton).toHaveClass('cursor-pointer', 'hover:bg-teal-800')
  fireEvent.click(printButton)
  expect(print).toHaveBeenCalledOnce()
  expect(getEprReportMock).toHaveBeenCalledOnce()
})

test('shows an error and retries the dashboard request', async () => {
  getDashboardMock
    .mockRejectedValueOnce(new Error('Database unavailable'))
    .mockResolvedValueOnce(dashboardFixture)

  renderDashboard()

  expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(await screen.findByText('Live data from the Textile Track database.')).toBeInTheDocument()
  expect(getDashboardMock).toHaveBeenCalledTimes(2)
})

test('requires confirmation before submitting and locking the selected EPR quarter', async () => {
  getDashboardMock.mockResolvedValue(dashboardFixture)
  const draft: EprManagement = {
    status: 'draft',
    submitted_at: null,
    submitted_by: null,
    adjusted_report: null,
    adjustments: [],
    sites: [],
    actors: [{ id: 7, label: 'Manager' }],
    report: {
      year: 2026,
      quarter: 4,
      source: 'live_records',
      total_weight_received_kg: 100,
      resold_weight_kg: 10,
      repaired_weight_kg: 0,
      upcycled_weight_kg: 0,
      fibre_to_fibre_weight_kg: 0,
      downcycled_weight_kg: 0,
      exported_weight_kg: 0,
      landfilled_weight_kg: 0,
      incinerated_energy_recovery_weight_kg: 0,
      uncategorized_weight_kg: 90,
      excess_weight_kg: 0,
      recovery_rate_percent: 10,
      garments_missing_weight: 0,
    },
  }
  vi.mocked(getEprManagement).mockResolvedValue(draft)
  vi.mocked(submitEprQuarter).mockResolvedValue({
    ...draft,
    status: 'submitted',
    submitted_at: '2026-11-19T08:00:00Z',
    submitted_by: 'Manager',
    sites: [{ id: 1, label: 'Bangkok' }],
  })
  Element.prototype.scrollIntoView ??= vi.fn()

  renderDashboard()
  await screen.findByText('Live data from the Textile Track database.')
  fireEvent.click(screen.getByRole('button', { name: 'Manage EPR Report' }))
  const panel = within(screen.getByRole('dialog', { name: 'Manage EPR Report' }))
  const submit = await panel.findByRole('button', { name: 'Submit & Lock' })
  expect(submit).toBeDisabled()
  fireEvent.keyDown(panel.getByRole('combobox', { name: 'Recorded by' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: 'Manager' }))
  fireEvent.click(submit)
  expect(panel.getByText(/The original totals will be locked/)).toBeInTheDocument()
  expect(submitEprQuarter).not.toHaveBeenCalled()
  fireEvent.click(panel.getByRole('button', { name: 'Confirm submit and lock' }))

  expect(await panel.findByText('Original submitted totals')).toBeInTheDocument()
  expect(panel.getByText('No adjustments recorded.')).toBeInTheDocument()
  expect(panel.getByRole('button', { name: 'Add Adjustment' })).toBeEnabled()
  const [year, quarter] = vi.mocked(getEprManagement).mock.calls[0]
  expect(submitEprQuarter).toHaveBeenCalledWith(year, quarter, 7)
})
