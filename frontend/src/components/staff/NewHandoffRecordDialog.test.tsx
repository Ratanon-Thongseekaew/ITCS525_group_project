/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { recordHandoffAtPickup } from '@/api'
import {
  chooseOption,
  fillPickupEvidence,
  handoffOptions,
  handoffRecord,
  readyBin,
  scalePhoto,
  STAFF_ID,
  stubRadixBrowserApis,
} from '@/test/handoff-fixtures'
import { NewHandoffRecordDialog } from './NewHandoffRecordDialog'

vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api')>()),
  recordHandoffAtPickup: vi.fn(),
}))

stubRadixBrowserApis()

function renderDialog() {
  const onClose = vi.fn()
  const onRecorded = vi.fn()
  render(
    <NewHandoffRecordDialog
      bin={readyBin()}
      contractors={handoffOptions.contractors}
      actorId={STAFF_ID}
      onClose={onClose}
      onRecorded={onRecorded}
    />,
  )
  return { onClose, onRecorded }
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Handoff' }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 21, 10, 47) })
  vi.mocked(recordHandoffAtPickup).mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

test('prefills the pickup time with now and the staff weight with the bin weight', () => {
  renderDialog()

  expect(screen.getByLabelText('Pickup Date')).toHaveValue('2026-11-21')
  expect(screen.getByLabelText('Pickup Time')).toHaveTextContent('10:30 AM')
  expect(screen.getByLabelText('Staff Weight (kg)')).toHaveValue(40)
  expect(screen.queryByLabelText(/Notes/)).not.toBeInTheDocument()
})

test('requires the contractor and every piece of pickup evidence', () => {
  renderDialog()

  submit()

  for (const message of [
    'Select a contractor.',
    "Enter the driver's weight.",
    "Enter the driver's name.",
    'Enter the vehicle plate number.',
    'Attach a photo of the scale reading.',
  ]) {
    expect(screen.getByText(message)).toBeInTheDocument()
  }
  expect(recordHandoffAtPickup).not.toHaveBeenCalled()
})

test.each([
  [scalePhoto('application/pdf'), 'Use a JPEG, PNG, or WebP photo.'],
  [scalePhoto('image/png', 5 * 1024 * 1024 + 1), 'Use a photo of 5 MB or smaller.'],
])('rejects an unusable scale photo', (photo, message) => {
  renderDialog()
  chooseOption('Contractor', 'GreenLoop Recycling')
  fillPickupEvidence({ photo })

  submit()

  expect(screen.getByText(message)).toBeInTheDocument()
  expect(recordHandoffAtPickup).not.toHaveBeenCalled()
})

test('refuses a pickup time in the future', () => {
  renderDialog()
  chooseOption('Contractor', 'GreenLoop Recycling')
  fillPickupEvidence()
  chooseOption('Pickup Time', '11:00 AM')

  submit()

  expect(screen.getByText("Pickup time can't be in the future.")).toBeInTheDocument()
  expect(recordHandoffAtPickup).not.toHaveBeenCalled()
})

test('warns before saving when the weights differ by more than 3%', () => {
  renderDialog()

  fillPickupEvidence({ driverWeight: '41.2' })
  expect(screen.getByRole('status')).toHaveTextContent(
    'Weight difference: 1.2 kg (3.00% of the staff weight). Within 3%.',
  )

  fillPickupEvidence({ driverWeight: '42' })
  expect(screen.getByRole('status')).toHaveTextContent(
    'Weight difference: 2.0 kg (5.00% of the staff weight). Over 3%, so this handoff will be marked Disputed',
  )
})

test('records the handoff and its evidence in one request', async () => {
  const saved = handoffRecord()
  vi.mocked(recordHandoffAtPickup).mockResolvedValue(saved)
  const { onRecorded } = renderDialog()
  chooseOption('Contractor', 'Circular Fibre Co.')
  const photo = scalePhoto()
  fillPickupEvidence({ photo })

  submit()

  await waitFor(() => expect(onRecorded).toHaveBeenCalledWith(saved))
  expect(recordHandoffAtPickup).toHaveBeenCalledExactlyOnceWith({
    bin_id: 1,
    contractor_id: 2,
    actor_id: STAFF_ID,
    picked_up_at: new Date(2026, 10, 21, 10, 30).toISOString(),
    staff_weight_kg: 40,
    driver_weight_kg: 40.5,
    driver_name: 'Somchai P.',
    vehicle_plate_number: '1KB-2345',
    scale_photo: photo,
  })
})

test('shows the API error in the dialog and allows another try', async () => {
  vi.mocked(recordHandoffAtPickup).mockRejectedValue(new Error('This bin already has a handoff.'))
  const { onRecorded } = renderDialog()
  chooseOption('Contractor', 'GreenLoop Recycling')
  fillPickupEvidence()

  submit()

  expect(await screen.findByText('This bin already has a handoff.')).toBeInTheDocument()
  expect(onRecorded).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Confirm Handoff' })).toBeEnabled()
})

test.each([
  ['the X button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
  ['Escape', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
])('closes without saving using %s', (_, close) => {
  const { onClose, onRecorded } = renderDialog()

  close()

  expect(onClose).toHaveBeenCalledOnce()
  expect(onRecorded).not.toHaveBeenCalled()
})
