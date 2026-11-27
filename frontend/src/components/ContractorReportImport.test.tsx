/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  importContractorReport,
  parseAndValidateContractorFile,
  type ContractorReportParsedRow,
  type User,
} from '@/api'

import ContractorReportImport from './ContractorReportImport'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return {
    ...original,
    fetchContractorReportOptions: vi.fn().mockResolvedValue({
      contractors: [
        { id: 2, name: 'GreenLoop Partner' },
        { id: 3, name: 'ReWeave Recyclers' },
      ],
    }),
    parseAndValidateContractorFile: vi.fn(),
    importContractorReport: vi.fn(),
  }
})

const session = vi.hoisted(() => ({ user: null as User | null }))
vi.mock('@/lib/auth-session', () => ({
  useSession: () => (session.user ? { token: 'token', user: session.user } : null),
}))

const parseMock = vi.mocked(parseAndValidateContractorFile)
const importMock = vi.mocked(importContractorReport)

function user(role: User['role']): User {
  return { id: 4, username: 'm', role, full_name: null, must_change_password: false, store: null }
}

function parsedRow(overrides: Partial<ContractorReportParsedRow>): ContractorReportParsedRow {
  return {
    row: 2,
    bin_id: 'BKK-RC-001',
    site_name: 'Bangkok Sorting Center',
    staff_weight_kg: 12.0,
    received_kg: 12.1,
    dispositions: {
      upcycled_kg: 4.2,
      fibre_to_fibre_kg: 4.8,
      downcycled_kg: 1.8,
      exported_kg: 0.6,
      landfilled_kg: 0.2,
      incinerated_energy_recovery_kg: 0.2,
    },
    categorized_weight_kg: 11.8,
    uncategorized_weight_kg: 0.3,
    status: 'Warning',
    errors: [],
    warnings: ['Uncategorized remainder: 0.30 kg.'],
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 27))
  session.user = user('manager')
  parseMock.mockResolvedValue({
    filename: 'report.csv',
    rows: [
      parsedRow({}),
      parsedRow({
        row: 3,
        bin_id: 'CNX-RC-001',
        site_name: 'Chiang Mai Sorting Center',
        staff_weight_kg: null,
        uncategorized_weight_kg: 0,
        status: 'Verified',
        warnings: [],
      }),
      parsedRow({
        row: 4,
        bin_id: 'BKK-RC-002',
        status: 'Error',
        warnings: [],
        errors: ["Bin 'BKK-RC-002' was picked up in 2026-11, not in the report month 2026-10."],
      }),
    ],
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function renderImport() {
  render(
    <MemoryRouter>
      <ContractorReportImport />
    </MemoryRouter>,
  )
}

async function uploadReport() {
  renderImport()
  await screen.findByText('GreenLoop Partner')
  const file = new File(['bin_id\n'], 'report.csv', { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText('Contractor report file'), { target: { files: [file] } })
  await screen.findByText('Review Report Validation')
}

test('asks for month and contractor only, defaulting the month to the previous month', async () => {
  renderImport()

  expect(await screen.findByText('GreenLoop Partner')).toBeInTheDocument()
  expect(screen.queryByLabelText('Sorting Center (Site)')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Report Month')).toHaveValue('2026-10')
  expect(screen.getByText('Maximum File Size: 5 MB')).toBeInTheDocument()
})

test('reviews each row with its site, staff weight, warnings and errors', async () => {
  await uploadReport()

  expect(parseMock).toHaveBeenCalledWith({
    actorId: 4,
    filename: 'report.csv',
    contentBase64: expect.any(String),
    reportMonth: '2026-10',
    contractorId: 2,
  })
  expect(screen.getByRole('columnheader', { name: 'Site' })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Staff Wt' })).toBeInTheDocument()

  const firstRow = screen.getByText('BKK-RC-001').closest('tr')!
  expect(within(firstRow).getByText('Bangkok Sorting Center')).toBeInTheDocument()
  expect(within(firstRow).getByText('12 kg')).toBeInTheDocument()
  expect(within(firstRow).getByText('Uncategorized remainder: 0.30 kg.')).toBeInTheDocument()
  const secondRow = screen.getByText('CNX-RC-001').closest('tr')!
  expect(within(secondRow).getByText('—')).toBeInTheDocument()
  expect(
    screen.getByText("Bin 'BKK-RC-002' was picked up in 2026-11, not in the report month 2026-10."),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Download Rejected Rows' })).toBeInTheDocument()
})

test('saves the non-rejected rows with the actor and contractor ids', async () => {
  importMock.mockResolvedValue({
    reports: [
      { report_id: 7, site_id: 1, site_name: 'Bangkok Sorting Center', imported_rows: 1 },
      { report_id: 8, site_id: 2, site_name: 'Chiang Mai Sorting Center', imported_rows: 1 },
    ],
    contractor_name: 'GreenLoop Partner',
    report_month: '2026-10-01',
    imported_rows: 2,
    total_received_kg: 24.2,
    total_categorized_weight_kg: 23.6,
    message: 'Successfully imported 2 validated record(s).',
  })
  await uploadReport()

  fireEvent.click(screen.getByRole('button', { name: /Save Valid Records \(2\)/ }))

  expect(await screen.findByText(/Bangkok Sorting Center • Report #7/)).toBeInTheDocument()
  expect(screen.getByText(/Chiang Mai Sorting Center • Report #8/)).toBeInTheDocument()
  const request = importMock.mock.calls[0][0]
  expect(request).toMatchObject({ actor_id: 4, contractor_id: 2, report_month: '2026-10' })
  expect(request.rows.map((row) => row.bin_id)).toEqual(['BKK-RC-001', 'CNX-RC-001'])
  expect(request.rows[0]).not.toHaveProperty('store_weight_kg')
})

test('there is no built-in sample report', async () => {
  renderImport()
  await screen.findByText('GreenLoop Partner')

  expect(screen.queryByRole('button', { name: /Review Sample/ })).not.toBeInTheDocument()
})

test('the formatting guide opens as a dialog listing the columns', async () => {
  renderImport()

  fireEvent.click(screen.getByRole('button', { name: /Formatting Guide/ }))

  const dialog = await screen.findByRole('dialog', { name: 'Formatting Guide' })
  expect(within(dialog).getByText('received_kg')).toBeInTheDocument()
  expect(within(dialog).queryByText('store_weight_kg')).not.toBeInTheDocument()
})

test('staff accounts cannot import reports', async () => {
  session.user = user('staff')
  renderImport()
  await screen.findByText('GreenLoop Partner')

  const file = new File(['bin_id\n'], 'report.csv', { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText('Contractor report file'), { target: { files: [file] } })

  expect(
    await screen.findByText('Sign in as a manager or admin to import reports.'),
  ).toBeInTheDocument()
  expect(parseMock).not.toHaveBeenCalled()
})
