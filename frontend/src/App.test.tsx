/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

function renderRoute(route: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ message: 'Hello from FastAPI!' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

test('renders the staff route', () => {
  renderRoute('/staff')

  expect(screen.getByRole('heading', { name: 'Your work, clearly organized.' })).toBeInTheDocument()
})

test('shows the loading component for two seconds before rendering the admin page', () => {
  vi.useFakeTimers()
  renderRoute('/admin')

  const loadingStatus = screen.getByRole('status', { name: 'กำลังโหลดหน้า Admin...' })

  expect(loadingStatus).toHaveClass('fixed', 'inset-0')
  expect(loadingStatus.querySelector('.textile-loader__mark')).toHaveStyle(
    '--textile-loader-size: 220px',
  )
  expect(
    screen.queryByRole('heading', { name: 'Control with confidence.' }),
  ).not.toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(2_000)
  })

  expect(screen.getByRole('heading', { name: 'Control with confidence.' })).toBeInTheDocument()
})

test('shows the loading component for two seconds before rendering the manager page', () => {
  vi.useFakeTimers()
  renderRoute('/manager')

  const loadingStatus = screen.getByRole('status', { name: 'กำลังโหลดหน้า Manager...' })

  expect(loadingStatus).toHaveClass('fixed', 'inset-0')
  expect(loadingStatus.querySelector('.textile-loader__mark')).toHaveStyle(
    '--textile-loader-size: 220px',
  )
  expect(
    screen.queryByRole('heading', { name: 'Contractor Monthly Report Import & Verification' }),
  ).not.toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(2_000)
  })

  expect(
    screen.getByRole('heading', { name: 'Contractor Monthly Report Import & Verification' }),
  ).toBeInTheDocument()
})

test('renders the login page at the root route', () => {
  renderRoute('/')

  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(screen.getByText('Admin access')).toBeInTheDocument()
})

test('redirects the demo admin login through the loader to the admin workspace', () => {
  vi.useFakeTimers()
  renderRoute('/')

  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'demo-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(screen.getByRole('status', { name: 'กำลังโหลดหน้า Admin...' })).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(2_000)
  })

  expect(screen.getByRole('heading', { name: 'Control with confidence.' })).toBeInTheDocument()
})

test('uses the shared workspace sidebar and navigates between staff sections', async () => {
  renderRoute('/staff')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: 'Resale Bin Records' }))

  expect(await screen.findByRole('heading', { name: 'Resale Bin Records' })).toBeInTheDocument()
})
