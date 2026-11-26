/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { User } from '@/api'
import { signInAs } from '@/test/auth'
import { chooseOption, stubRadixBrowserApis } from '@/test/handoff-fixtures'
import { UserManagementPage } from './UserManagementPage'

const store = { id: 2, code: 'IS', name: 'IconSiam' }

function user(id: number, full_name: string, overrides: Partial<User> = {}): User {
  return {
    id,
    username: `user${id}@example.com`,
    role: 'staff',
    full_name,
    must_change_password: false,
    store,
    ...overrides,
  }
}

const users = [user(1, 'Mina N.'), user(2, 'Ploy S.', { role: 'manager', store: null })]

beforeEach(() => {
  stubRadixBrowserApis()
  signInAs('admin')
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function renderPage(write?: () => Response) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (init?.method && init.method !== 'GET') return Promise.resolve(write!())
    return Promise.resolve(json(String(input).startsWith('/api/sites') ? [store] : users))
  })
  render(<UserManagementPage />)
  await screen.findByRole('table')
  return fetchMock
}

function usersTable() {
  return within(screen.getByRole('table'))
}

function openActions(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions for ${name}` }), { key: 'Enter' })
}

function fill(name: string, email: string) {
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } })
}

test('shows inline errors and asks for a store only for staff', async () => {
  await renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(screen.getByText('Enter a full name.')).toBeInTheDocument()
  expect(screen.getByText('Select a role.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()

  chooseOption('Role', 'Store Staff')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByText('Select a store.')).toBeInTheDocument()
})

test('adds a user without sending a password and shows the temporary one', async () => {
  const created = user(3, 'Narin S.', { must_change_password: true })
  const fetchMock = await renderPage(() =>
    json({ ...created, temporary_password: 'Temp-pass-1234' }, 201),
  )

  fill('Narin S.', 'user3@example.com')
  chooseOption('Role', 'Store Staff')
  chooseOption('Store', 'IconSiam')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  const dialog = within(await screen.findByRole('dialog', { name: 'Temporary password' }))
  expect(dialog.getByText('Temp-pass-1234')).toBeInTheDocument()
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    username: 'user3@example.com',
    full_name: 'Narin S.',
    role: 'staff',
    site_id: 2,
  })

  fireEvent.click(dialog.getByRole('button', { name: 'Done' }))
  expect(screen.queryByText('Temp-pass-1234')).not.toBeInTheDocument()
  expect(usersTable().getByRole('row', { name: /Narin S\./ })).toBeInTheDocument()
})

test('shows the server message when adding fails', async () => {
  await renderPage(() => json({ detail: 'Username already exists' }, 409))

  fill('Someone', 'taken@example.com')
  chooseOption('Role', 'Manager')
  chooseOption('Store', 'IconSiam')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByText('Username already exists')).toBeInTheDocument()
})

test('filters users by search and role', async () => {
  await renderPage()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search users' }), {
    target: { value: 'ploy' },
  })
  expect(usersTable().queryByText('Mina N.')).not.toBeInTheDocument()

  chooseOption('Filter by role', 'Store Staff')
  expect(usersTable().getByText('No users match your search.')).toBeInTheDocument()
})

test('edits a user, sending only what changed', async () => {
  const fetchMock = await renderPage(() => json(user(1, 'Mina Noi')))

  openActions('Mina N.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit user' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Edit user' }))
  fireEvent.change(dialog.getByLabelText('Full name'), { target: { value: 'Mina Noi' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(usersTable().getByText('Mina Noi')).toBeInTheDocument()
  const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ full_name: 'Mina Noi' })
})

test('confirms before deleting a user', async () => {
  await renderPage(() => new Response(null, { status: 204 }))

  openActions('Mina N.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete user' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Delete Mina N.?' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Delete user' }))

  await waitFor(() => expect(usersTable().queryByText('Mina N.')).not.toBeInTheDocument())
})

test('resets a password and shows the new temporary one', async () => {
  await renderPage(() => json({ ...users[0], temporary_password: 'New-temp-5678' }))

  openActions('Mina N.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reset password' }))
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset password' }),
  )

  expect(await screen.findByText('New-temp-5678')).toBeInTheDocument()
})
