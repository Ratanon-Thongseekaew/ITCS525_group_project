/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
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

test.each([
  ['/manager', 'Keep the team moving.'],
  ['/staff', 'Your work, clearly organized.'],
  ['/admin', 'Control with confidence.'],
])('renders the %s route', (route, heading) => {
  renderRoute(route)

  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
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
})

test('redirects the demo admin login to the admin workspace', async () => {
  renderRoute('/')

  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'demo-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(
    await screen.findByRole('heading', { name: 'Control with confidence.' }),
  ).toBeInTheDocument()
})

const staffNavigation = [
  ['Sorting', '/staff'],
  ['Direct Resale', '/direct-resale'],
  ['Recycle Bin Handoff', '/staff/recycle-bin-handoff'],
] as const

const sharedNavigation = ['Compliance Dashboard', 'Resale Bin Records', 'Recycle Bin Records']

test('shows the Figma navigation in the staff sidebar', () => {
  renderRoute('/staff')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  for (const [label, href] of staffNavigation) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
  }
  for (const label of [...sharedNavigation, 'User Management']) {
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
})

test.each([
  ['/manager', false],
  ['/admin', true],
])('keeps the existing sidebar items at %s', (route, hasUserManagement) => {
  renderRoute(route)

  for (const label of sharedNavigation) {
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
  renderRoute('/staff')

  fireEvent.click(screen.getByRole('link', { name: 'Recycle Bin Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('opens Direct Resale from the staff sidebar', async () => {
  renderRoute('/staff')

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
  renderRoute('/staff/recycle-bin-handoff/records')

  expect(screen.getByRole('heading', { name: 'Handoff Records' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-001' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-002' })).toBeInTheDocument()
  expect(screen.getByText('Outcome report is still pending!')).toBeInTheDocument()
  expect(screen.getByText('Total Reported').nextElementSibling).toHaveTextContent('39.0 kg')
  expect(screen.getByText('Variance').nextElementSibling).toHaveTextContent('-1.0 kg')
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test('returns to New Bins for Handoff from Handoff Records', async () => {
  renderRoute('/staff/recycle-bin-handoff/records')

  fireEvent.click(screen.getByRole('link', { name: 'Back to Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('keeps Recycle Bin Handoff active on its sub-routes', () => {
  renderRoute('/staff/recycle-bin-handoff/records')

  expect(screen.getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'false')
})

test('marks only Sorting active at the staff root', () => {
  renderRoute('/staff')

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'false',
  )
})
