/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { chooseOption, stubRadixBrowserApis } from '@/test/handoff-fixtures'
import { UserManagementPage } from './UserManagementPage'

beforeEach(stubRadixBrowserApis)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function usersTable() {
  return within(screen.getByRole('table'))
}

function openActions(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions for ${name}` }), { key: 'Enter' })
}

test('shows inline errors for an incomplete invite', () => {
  render(<UserManagementPage />)

  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(screen.getByText('Enter a full name.')).toBeInTheDocument()
  expect(screen.getByText('Enter an email address.')).toBeInTheDocument()
  expect(screen.getByText('Select a role.')).toBeInTheDocument()
  expect(screen.getByText('Select a store.')).toBeInTheDocument()
  expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true')
})

test('rejects an email that already exists', () => {
  render(<UserManagementPage />)

  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'MINA@storeflow.co' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(screen.getByText('This email already exists.')).toBeInTheDocument()
})

test('adds a valid invite as an Invited user', () => {
  render(<UserManagementPage />)

  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Narin S.' } })
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'narin@storeflow.co' },
  })
  chooseOption('Role', 'Store Staff')
  chooseOption('Store', 'IconSiam')
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  const row = usersTable().getByRole('row', { name: /Narin S\./ })
  expect(within(row).getByText('Invited')).toBeInTheDocument()
  expect(within(row).getByText('IconSiam')).toBeInTheDocument()
  expect(screen.getByLabelText('Full name')).toHaveValue('')
})

test('filters users by search and role, with an empty state', () => {
  render(<UserManagementPage />)

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search users' }), {
    target: { value: 'ploy' },
  })
  expect(usersTable().getByText('Ploy S.')).toBeInTheDocument()
  expect(usersTable().queryByText('Mina N.')).not.toBeInTheDocument()

  chooseOption('Filter by role', 'Manager')
  expect(usersTable().getByText('No users match your search.')).toBeInTheDocument()
})

test('edits a user', () => {
  render(<UserManagementPage />)

  openActions('Kai P.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit user' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Edit user' }))
  fireEvent.change(dialog.getByLabelText('Full name'), { target: { value: 'Kai Prasert' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(usersTable().getByText('Kai Prasert')).toBeInTheDocument()
})

test('confirms before deleting a user', () => {
  render(<UserManagementPage />)

  openActions('Than R.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete user' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Delete Than R.?' }))
  expect(dialog.getByText('No data history will be deleted.')).toBeInTheDocument()
  fireEvent.click(dialog.getByRole('button', { name: 'Delete user' }))

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(usersTable().queryByText('Than R.')).not.toBeInTheDocument()
})
