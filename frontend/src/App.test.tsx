/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
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

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

function renderRoute(route: string) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: 'Hello from FastAPI!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
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

test('renders the admin page immediately when visited directly', () => {
  renderRoute('/admin')

  expect(screen.getByRole('heading', { name: 'Control with confidence.' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'loading...' })).not.toBeInTheDocument()
})

test('redirects the manager root to the compliance dashboard', () => {
  renderRoute('/manager')

  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.queryByRole('status', { name: 'loading...' })).not.toBeInTheDocument()
})

test('navigates from the manager workspace to the compliance dashboard path', () => {
  renderRoute('/manager/resale-bins')

  fireEvent.click(screen.getByRole('link', { name: 'Compliance Dashboard' }))

  const complianceDashboardLink = screen.getByRole('link', { name: 'Compliance Dashboard' })

  expect(complianceDashboardLink).toHaveAttribute('href', '/manager/compliance-dashboard')
  expect(complianceDashboardLink).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.getByText('Recycling Bins Collected')).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('renders and processes a direct resale bin on its own page', async () => {
  renderRoute('/direct-resale')

  expect(screen.getByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /#bin-id-001/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(await screen.findByText('Processed')).toBeInTheDocument()
})

test('renders the login page at the root route', () => {
  renderRoute('/')

  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(screen.getByText('Admin access')).toBeInTheDocument()

  const backgroundVideo = document.querySelector('video')
  const videoSource = backgroundVideo?.querySelector('source')

  expect(backgroundVideo).toHaveAttribute('autoplay')
  expect(backgroundVideo).toHaveAttribute('loop')
  expect(backgroundVideo).toHaveAttribute('playsinline')
  expect(videoSource).toHaveAttribute('src', 'https://www.pexels.com/download/video/9594356/')
})

test('toggles password visibility from the login form', () => {
  renderRoute('/')

  const passwordInput = screen.getByLabelText('Password')
  expect(passwordInput).toHaveAttribute('type', 'password')

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))

  expect(passwordInput).toHaveAttribute('type', 'text')
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))

  expect(passwordInput).toHaveAttribute('type', 'password')
})

test('redirects the demo admin login through the loader to the admin workspace', () => {
  vi.useFakeTimers()
  const successToast = vi.spyOn(toast, 'success')
  renderRoute('/')

  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'demo-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(successToast).toHaveBeenCalledWith('Login successful', {
    description: 'Opening the admin workspace...',
  })
  expect(screen.getByRole('status', { name: 'loading...' })).toBeInTheDocument()

  act(() => {
    vi.advanceTimersByTime(2_000)
  })

  expect(screen.getByRole('heading', { name: 'Control with confidence.' })).toBeInTheDocument()
})

test('keeps the login form visible and shows an alert for an invalid demo username', () => {
  const errorToast = vi.spyOn(toast, 'error')
  renderRoute('/')

  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'WrongUser' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'demo-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(screen.getByRole('heading', { name: 'Login failed' })).toBeInTheDocument()
  expect(screen.getByText('Use Admin01 for the admin workspace.')).toBeInTheDocument()
  expect(errorToast).toHaveBeenCalledWith('Login failed', {
    description: 'Use Admin01 for the admin workspace.',
  })
  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'loading...' })).not.toBeInTheDocument()
})

test('uses the shared workspace sidebar and navigates between staff sections', async () => {
  renderRoute('/staff')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: 'Resale Bin Records' }))

  expect(await screen.findByRole('heading', { name: 'Resale Bin Records' })).toBeInTheDocument()
})
