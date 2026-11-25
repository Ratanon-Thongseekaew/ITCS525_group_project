/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RecordCard, RecordDetail } from './RecordCard'

afterEach(cleanup)

const details = (
  <>
    <RecordDetail label="Item count">25 items</RecordDetail>
    <RecordDetail label="Grossed Weight">4kg</RecordDetail>
  </>
)

test('renders a read-only record with its details and status', () => {
  render(<RecordCard icon={null} title="#bin-001" details={details} status="Processed" />)

  expect(screen.getByRole('heading', { level: 3, name: '#bin-001' })).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText('Item count').nextElementSibling).toHaveTextContent('25 items')
  expect(screen.getByText('Status').nextElementSibling).toHaveTextContent('Processed')
  expect(screen.getByText('Item count').closest('dl')).toBeInTheDocument()
})

test('selects the record through a button named by its title', () => {
  const onSelect = vi.fn()
  render(
    <RecordCard
      icon={null}
      title="#bin-002"
      details={details}
      onSelect={onSelect}
      selectProps={{ 'aria-haspopup': 'dialog' }}
    />,
  )

  const button = screen.getByRole('button', { name: '#bin-002' })
  expect(button).toHaveAttribute('aria-haspopup', 'dialog')
  fireEvent.click(button)
  expect(onSelect).toHaveBeenCalledOnce()
})

test('disables selection', () => {
  render(<RecordCard icon={null} title="#bin-003" onSelect={() => {}} selectDisabled />)

  expect(screen.getByRole('button', { name: '#bin-003' })).toBeDisabled()
})
