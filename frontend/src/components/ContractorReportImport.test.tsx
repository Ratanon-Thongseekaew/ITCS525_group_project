/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'

import { validateContractorReport } from '@/api'

import ContractorReportImport from './ContractorReportImport'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return { ...original, validateContractorReport: vi.fn() }
})

const validateContractorReportMock = vi.mocked(validateContractorReport)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

test('shows incineration with energy recovery separately and displays uncategorized weight', async () => {
  validateContractorReportMock.mockResolvedValue({
    rows: [
      {
        row: 1,
        categorized_weight_kg: 11.8,
        uncategorized_weight_kg: 0.3,
        is_valid: true,
        errors: [],
      },
      {
        row: 2,
        categorized_weight_kg: 10.6,
        uncategorized_weight_kg: 0,
        is_valid: false,
        errors: ['Disposition weights exceed received weight by 0.600 kg.'],
      },
      {
        row: 3,
        categorized_weight_kg: 13.9,
        uncategorized_weight_kg: 0,
        is_valid: true,
        errors: [],
      },
      {
        row: 4,
        categorized_weight_kg: 15.8,
        uncategorized_weight_kg: 0,
        is_valid: true,
        errors: [],
      },
    ],
  })

  render(
    <MemoryRouter>
      <ContractorReportImport />
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Review Report Validation')).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Landfilled' })).toBeInTheDocument()
  expect(
    screen.getByRole('columnheader', { name: 'Incinerated with energy recovery' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: 'Uncategorized' })).toBeInTheDocument()
  const firstReportRow = screen.getByText('BIN-C-0047').closest('tr')
  expect(firstReportRow).not.toBeNull()
  expect(within(firstReportRow!).getByText('0.3 kg')).toBeInTheDocument()
  expect(
    screen.getByText('Disposition weights exceed received weight by 0.600 kg.'),
  ).toBeInTheDocument()

  expect(validateContractorReportMock).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({
        dispositions: expect.objectContaining({
          landfilled_kg: 0.2,
          incinerated_energy_recovery_kg: 0.2,
        }),
      }),
    ]),
  )
})
