/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { getResaleStoreSummary } from '@/api'
import { signInAs } from '@/test/auth'

import ResaleBinRecords from './ResaleBinRecords'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return { ...original, getResaleStoreSummary: vi.fn() }
})

const getResaleStoreSummaryMock = vi.mocked(getResaleStoreSummary)

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.clearAllMocks()
})

test('renders store actual values and their top-five total from the API', async () => {
  getResaleStoreSummaryMock.mockResolvedValue({
    stores: [
      { id: 1, name: 'Store One', actual_value: 185000 },
      { id: 2, name: 'Store Two', actual_value: 1000 },
      { id: 3, name: 'Store Three', actual_value: 999 },
      { id: 4, name: 'Store Four', actual_value: 70000 },
      { id: 5, name: 'Store Five', actual_value: 60000 },
    ],
  })
  signInAs('manager')

  render(<ResaleBinRecords />)

  expect(screen.getByRole('status', { name: 'Loading resale store data' })).toBeInTheDocument()
  expect(await screen.findByText('Store One')).toBeInTheDocument()
  expect(screen.getByText('Store Five')).toBeInTheDocument()
  expect(screen.getByText('185K฿')).toBeInTheDocument()
  expect(screen.getByText('1K฿')).toBeInTheDocument()
  expect(screen.getByText('999฿')).toBeInTheDocument()
  expect(screen.getByText('317K฿')).toBeInTheDocument()
  expect(screen.queryByText(/THB/)).not.toBeInTheDocument()
  expect(getResaleStoreSummaryMock).toHaveBeenCalledWith('test-token', expect.any(AbortSignal))
})
