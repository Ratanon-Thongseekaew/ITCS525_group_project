/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

function renderDialog(destructive = false) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="Delete Mina N.?"
      description="This cannot be undone."
      confirmLabel="Delete user"
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>Mina N. · Manager</p>
    </ConfirmDialog>,
  )
  return { onConfirm, onCancel }
}

test('shows the title, description, and extra content in an alert dialog', () => {
  renderDialog()

  const dialog = screen.getByRole('alertdialog', { name: 'Delete Mina N.?' })
  expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  expect(screen.getByText('Mina N. · Manager')).toBeInTheDocument()
})

test('confirms or cancels', () => {
  const { onConfirm, onCancel } = renderDialog()

  fireEvent.click(screen.getByRole('button', { name: 'Delete user' }))
  expect(onConfirm).toHaveBeenCalledOnce()

  cleanup()
  const second = renderDialog()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(second.onCancel).toHaveBeenCalledOnce()
  expect(second.onConfirm).not.toHaveBeenCalled()
  expect(onCancel).not.toHaveBeenCalled()
})

test('uses the destructive button for destructive actions', () => {
  renderDialog(true)

  expect(screen.getByRole('button', { name: 'Delete user' })).toHaveAttribute(
    'data-variant',
    'destructive',
  )
})
