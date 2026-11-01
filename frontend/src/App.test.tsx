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

test('uses the shared workspace sidebar and navigates between staff sections', async () => {
  renderRoute('/staff')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('link', { name: 'Resale Bin Records' }))

  expect(await screen.findByRole('heading', { name: 'Resale Bin Records' })).toBeInTheDocument()
})
