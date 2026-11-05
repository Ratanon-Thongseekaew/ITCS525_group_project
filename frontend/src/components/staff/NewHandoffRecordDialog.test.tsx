/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { HandoffBin } from '@/types/handoff'
import { NewHandoffRecordDialog } from './NewHandoffRecordDialog'

// jsdom lacks these browser APIs, which Radix Select needs.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const bin: HandoffBin = {
  id: 'b1',
  bin_code: 'bin-id-001',
  bin_type: 'recycle',
  status: 'awaiting_handoff',
  item_count: 100,
  total_weight_kg: 40,
  packed_at: '2026-10-01T15:30:00',
}

function renderDialog(defaultPickup: string | null = '2026-10-20T18:30:00') {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(
    <NewHandoffRecordDialog
      bin={bin}
      defaultPickup={defaultPickup}
      onClose={onClose}
      onConfirm={onConfirm}
      onCloseAutoFocus={() => {}}
    />,
  )
  return { onClose, onConfirm }
}

function chooseOption(label: string, option: string) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' })
  fireEvent.click(screen.getByRole('option', { name: option }))
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Handoff' }))
}

afterEach(() => {
  cleanup()
})

test('shows the bin details', () => {
  renderDialog()

  const dialog = within(screen.getByRole('dialog', { name: 'New Handoff Record' }))

  expect(dialog.getByText('#bin-id-001')).toBeInTheDocument()
  expect(dialog.getByText('Recycling Bin')).toBeInTheDocument()
  expect(dialog.getByText('Item Count').nextElementSibling).toHaveTextContent('100 items')
  expect(dialog.getByText('Grossed Weight').nextElementSibling).toHaveTextContent('40kg')
  expect(dialog.getByText('Packed at 3:30 PM, 1 OCT 2026')).toBeInTheDocument()
})

test('prefills the pickup date and time from the next scheduled pickup', () => {
  renderDialog()

  expect(screen.getByLabelText('Pickup Date')).toHaveValue('2026-10-20')
  expect(screen.getByLabelText('Pickup Time')).toHaveTextContent('6:30 PM')
  expect(screen.getByLabelText('Contractor')).toHaveTextContent('Select a contractor')
})

test('blocks an incomplete submit and clears each error once fixed', () => {
  const { onConfirm } = renderDialog(null)

  submit()

  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.getByText('Select a contractor.')).toBeInTheDocument()
  expect(screen.getByText('Select a pickup date.')).toBeInTheDocument()
  expect(screen.getByText('Select a pickup time.')).toBeInTheDocument()
  expect(screen.getByLabelText('Contractor')).toHaveAttribute('aria-invalid', 'true')

  chooseOption('Contractor', 'Contractor 1')

  expect(screen.queryByText('Select a contractor.')).not.toBeInTheDocument()
  expect(screen.getByText('Select a pickup date.')).toBeInTheDocument()
})

test('leaves the time empty when the default pickup is not on a time slot', () => {
  renderDialog('2026-10-20T18:45:00')

  expect(screen.getByLabelText('Pickup Time')).toHaveTextContent('Select a time')
})

test('submits the entered record', () => {
  const { onConfirm } = renderDialog(null)

  chooseOption('Contractor', 'Contractor 2')
  fireEvent.change(screen.getByLabelText('Pickup Date'), { target: { value: '2026-12-03' } })
  chooseOption('Pickup Time', '12:30 AM')
  fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: '  Use the back gate  ' } })
  submit()

  expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
    bin_id: 'b1',
    contractor_id: 'c2',
    pickup_at: '2026-12-03T00:30:00',
    notes: 'Use the back gate',
  })
})

test('saves empty notes as null', () => {
  const { onConfirm } = renderDialog()

  chooseOption('Contractor', 'Contractor 1')
  fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: '   ' } })
  submit()

  expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
    bin_id: 'b1',
    contractor_id: 'c1',
    pickup_at: '2026-10-20T18:30:00',
    notes: null,
  })
})

test.each([
  ['the X button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
  ['Escape', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
])('closes without saving using %s', (_, close) => {
  const { onClose, onConfirm } = renderDialog()

  close()

  expect(onClose).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()
})
