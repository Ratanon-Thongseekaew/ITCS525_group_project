/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getDashboard } from '@/api'
import { dashboardFixture } from '@/test/dashboard-fixture'

import { ComplianceDashboardPage } from './ComplianceDashboardPage'

vi.mock('@/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api')>()
  return { ...original, getDashboard: vi.fn() }
})

const getDashboardMock = vi.mocked(getDashboard)

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
})

function renderDashboard() {
  render(
    <MemoryRouter initialEntries={['/manager/compliance-dashboard']}>
      <ComplianceDashboardPage />
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
