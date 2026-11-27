/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import App from '@/App'
import { getSession } from '@/lib/auth-session'
import { sessionUser, signInAs } from '@/test/auth'
import { dashboardFixture } from '@/test/dashboard-fixture'
import { handoffOptions, stubRadixBrowserApis } from '@/test/handoff-fixtures'

beforeEach(() => {
  stubRadixBrowserApis()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }))
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const staff = {
  id: 5,
  username: 'staff@example.com',
  role: 'staff',
  full_name: 'Narin S.',
  must_change_password: false,
  store: { id: 1, code: 'S1', name: 'Siam Square' },
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

/** Answers by path; anything unlisted gets an empty list. */
function mockApi(routes: Record<string, () => Response> = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const path = String(input).split('?')[0]
    if (routes[path]) return Promise.resolve(routes[path]())
    if (path === '/api/auth/me') return Promise.resolve(json(sessionUser()))
    if (path === '/api/handoffs/options') return Promise.resolve(json(handoffOptions))
    if (path === '/api/dashboard') return Promise.resolve(json(dashboardFixture))
    return Promise.resolve(json([]))
  })
}

function renderRoute(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

function submitLogin() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'some-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

test('signs in and opens the workspace for the role the server returns', async () => {
  mockApi({
    '/api/auth/login': () => json({ access_token: 'tok', token_type: 'bearer', user: staff }),
  })
  renderRoute('/login')
  submitLogin()

  expect(
    await screen.findByRole('heading', { name: 'Your work, clearly organized.' }),
  ).toBeInTheDocument()
  expect(getSession()?.token).toBe('tok')
})

test('shows an error for wrong credentials and stays signed out', async () => {
  mockApi({ '/api/auth/login': () => json({ detail: 'Invalid username or password' }, 401) })
  renderRoute('/login')
  submitLogin()

  expect(await screen.findByText('Wrong email or password.')).toBeInTheDocument()
  expect(getSession()).toBeNull()
})

test('sends signed-out visitors to the login page', () => {
  mockApi()
  renderRoute('/admin/users')

  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
})

test.each(['manager', 'staff'] as const)('blocks %s from admin pages', (role) => {
  signInAs(role)
  mockApi()
  renderRoute('/admin/users')

  expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument()
})

test('lets an admin open other workspaces', () => {
  signInAs('admin')
  mockApi()
  renderRoute('/staff/sorting')

  expect(screen.getByRole('heading', { name: 'Your work, clearly organized.' })).toBeInTheDocument()
})

test('lets an admin open manager pages too', () => {
  signInAs('admin')
  mockApi()
  renderRoute('/manager/sorting')

  expect(screen.getByRole('heading', { name: 'Sorting Overview' })).toBeInTheDocument()
})

test('sends staff from a manager page to their own workspace', () => {
  signInAs('staff')
  mockApi()
  renderRoute('/manager/compliance-dashboard')

  expect(screen.getByRole('heading', { name: 'Your work, clearly organized.' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Compliance Dashboard' })).not.toBeInTheDocument()
})

test('sends a manager from a staff page to their own workspace', () => {
  signInAs('manager')
  mockApi()
  renderRoute('/staff/direct-resale')

  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Direct Resale Bins' })).not.toBeInTheDocument()
})

test('requires a new password before anything else, then opens the workspace', async () => {
  signInAs('staff', { must_change_password: true })
  mockApi({ '/api/auth/change-password': () => json(staff) })
  renderRoute('/staff/sorting')

  expect(screen.getByRole('heading', { name: 'Set your new password' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Temporary password'), {
    target: { value: 'temporary-pass' },
  })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'my-new-password' } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'my-new-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))

  expect(
    await screen.findByRole('heading', { name: 'Your work, clearly organized.' }),
  ).toBeInTheDocument()
})

test('returns to login when the server rejects the token', async () => {
  signInAs('admin')
  mockApi({ '/api/auth/me': () => json({ detail: 'Not authenticated' }, 401) })
  renderRoute('/admin/users')

  expect(await screen.findByText('Your session ended. Sign in again.')).toBeInTheDocument()
  expect(getSession()).toBeNull()
})

test('signs out from the sidebar', async () => {
  signInAs('staff')
  mockApi()
  renderRoute('/staff/sorting')

  fireEvent.click(screen.getByRole('link', { name: 'Sign Out' }))

  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  await waitFor(() => expect(getSession()).toBeNull())
})
