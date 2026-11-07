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

test('renders the garment sorting workspace at the staff sorting route', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('heading', { name: 'Your work, clearly organized.' })).toBeInTheDocument()
})

test('renders user management immediately when visited directly', () => {
  renderRoute('/admin/users')

  expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument()
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

test('renders and processes a direct resale bin', async () => {
  renderRoute('/staff/direct-resale')

  expect(screen.getByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /#bin-id-001/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(await screen.findByText('No bins in this list.')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /#bin-id-001/i })).not.toBeInTheDocument()
})

test('links Direct Resale to the potential revenue analysis page', () => {
  renderRoute('/staff/direct-resale')

  expect(screen.getByRole('link', { name: 'Potential Revenue Analysis' })).toHaveAttribute(
    'href',
    '/staff/direct-resale/potential-revenue-analysis',
  )
  expect(screen.getByRole('link', { name: 'Processed Bin Records' })).toHaveAttribute(
    'href',
    '/staff/direct-resale/processed-bins-record',
  )
})

test('lists processed resale bins on their own page', () => {
  renderRoute('/staff/direct-resale/processed-bins-record')

  expect(screen.getByRole('heading', { name: 'Processed Bin Records' })).toBeInTheDocument()
  expect(screen.getByText('#bin-id-002')).toBeInTheDocument()
  expect(screen.getByText('#bin-id-003')).toBeInTheDocument()
  expect(screen.queryByText('#bin-id-001')).not.toBeInTheDocument()
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /#bin-id-002/i })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to bins' })).toHaveAttribute(
    'href',
    '/staff/direct-resale',
  )
  const directResaleLinks = screen.getAllByRole('link', { name: 'Direct Resale' })
  expect(directResaleLinks.some((link) => link.getAttribute('data-active') === 'true')).toBe(true)
})

test('renders potential revenue analysis from processed resale bins', () => {
  renderRoute('/staff/direct-resale/potential-revenue-analysis')

  expect(screen.getByRole('heading', { name: 'Potential Revenue Analysis' })).toBeInTheDocument()
  expect(screen.getByText('฿30,500')).toBeInTheDocument()
  expect(screen.getByText('2 processed bins')).toBeInTheDocument()
  const directResaleLinks = screen.getAllByRole('link', { name: 'Direct Resale' })
  expect(directResaleLinks.some((link) => link.getAttribute('data-active') === 'true')).toBe(true)
  expect(screen.getByRole('link', { name: 'Back to bins' })).toHaveAttribute(
    'href',
    '/staff/direct-resale',
  )
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

test('redirects the demo admin login through the loader to user management', () => {
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

  expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'User Management' })).toHaveAttribute(
    'data-active',
    'true',
  )
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

const staffNavigation = [
  ['Sorting', '/staff/sorting'],
  ['Direct Resale', '/staff/direct-resale'],
  ['Recycle Bin Handoff', '/staff/recycle-bin-handoff'],
] as const

const sharedNavigation = ['Compliance Dashboard', 'Resale Bin Records', 'Recycle Bin Records']

test('shows the Figma navigation in the staff sidebar', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  for (const [label, href] of staffNavigation) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
  }
  for (const label of [...sharedNavigation, 'User Management']) {
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
})

test.each([
  ['/manager', sharedNavigation, false],
  ['/admin/users', ['Compliance Dashboard'], true],
])('shows the role sidebar items at %s', (route, visibleNavigation, hasUserManagement) => {
  renderRoute(route)

  for (const label of visibleNavigation) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
  for (const [label] of staffNavigation) {
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
  expect(screen.queryByRole('link', { name: 'User Management' }) !== null).toBe(hasUserManagement)
})

test('navigates between shared workspace sections from the sidebar', async () => {
  renderRoute('/manager')

  fireEvent.click(screen.getByRole('link', { name: 'Resale Bin Records' }))

  expect(await screen.findByRole('heading', { name: 'Resale Bin Records' })).toBeInTheDocument()
})

test('opens New Bins for Handoff from the staff sidebar', async () => {
  renderRoute('/staff/sorting')

  fireEvent.click(screen.getByRole('link', { name: 'Recycle Bin Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('opens Direct Resale from the staff sidebar', async () => {
  renderRoute('/staff/sorting')

  fireEvent.click(screen.getByRole('link', { name: 'Direct Resale' }))

  expect(await screen.findByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
})

test('renders New Bins for Handoff with the mock data', () => {
  renderRoute('/staff/recycle-bin-handoff')

  expect(screen.getByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
  expect(screen.getByText('Bins Awaiting').nextElementSibling).toHaveTextContent('2')
  expect(screen.getByText('Items Staged').nextElementSibling).toHaveTextContent('200')
  expect(screen.getByText('Total Grossed Weight').nextElementSibling).toHaveTextContent('80 kg')
  expect(screen.getByText('Next Scheduled Pickup').nextElementSibling).toHaveTextContent(
    '20 Oct 2026',
  )
  expect(screen.getByRole('heading', { name: '#bin-id-001' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-002' })).toBeInTheDocument()
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test.each(['Scheduled Pickup Dates', 'Handoff Records'])(
  'navigates to %s from the handoff page',
  async (label) => {
    renderRoute('/staff/recycle-bin-handoff')

    fireEvent.click(screen.getByRole('link', { name: label }))

    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument()
  },
)

test('renders Handoff Records with the mock data', () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  expect(screen.getByRole('heading', { name: 'Handoff Records' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-001' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-002' })).toBeInTheDocument()
  expect(screen.getByText('Outcome report is still pending!')).toBeInTheDocument()
  expect(screen.getByText('Total Reported').nextElementSibling).toHaveTextContent('39.0 kg')
  expect(screen.getByText('Variance').nextElementSibling).toHaveTextContent('-1.0 kg')
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test('returns to New Bins for Handoff from Handoff Records', async () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  fireEvent.click(screen.getByRole('link', { name: 'Back to Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('keeps Recycle Bin Handoff active on its sub-routes', () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  expect(screen.getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'false')
})

test('marks only Sorting active at the sorting route', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'false',
  )
})

test.each([
  ['/staff/sorting', '/staff/sorting'],
  ['/admin/compliance-dashboard', '/admin/users'],
])('links the sidebar logo at %s to %s', (route, href) => {
  renderRoute(route)

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toHaveAttribute(
    'href',
    href,
  )
})

test('renders Direct Resale inside the shared workspace sidebar', () => {
  renderRoute('/staff/direct-resale')

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('href', '/staff/sorting')
  expect(screen.getByRole('link', { name: 'Direct Resale' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
})

test('shows the compliance dashboard to admins and keeps them in their workspace', () => {
  renderRoute('/admin/compliance-dashboard')

  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.getByRole('link', { name: 'Export Report' })).toHaveAttribute(
    'href',
    '/admin/compliance-dashboard',
  )
})

test('redirects the demo staff login to the sorting workspace', () => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  })
  vi.useFakeTimers()
  renderRoute('/')

  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: /staff/i }))
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'demo-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  act(() => {
    vi.advanceTimersByTime(2_000)
  })

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByText('Your work, clearly organized.')).toBeInTheDocument()
})

test('opens the contractor report import page from the compliance dashboard', () => {
  renderRoute('/manager/compliance-dashboard')

  fireEvent.click(screen.getByRole('link', { name: 'Import Monthly Files' }))

  expect(
    screen.getByRole('heading', { name: 'Import Monthly Outcome Report File' }),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Sign Out' })).toHaveLength(1)
})
