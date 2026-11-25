/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { FilterSelect } from './FilterSelect'

afterEach(cleanup)

const items = [
  { value: 'all', label: 'All Contractors' },
  { value: '1', label: 'GreenLoop Recycling' },
]

test('names a hidden-label trigger with aria-label and shows the full value as a tooltip', () => {
  render(<FilterSelect label="Contractor" value="1" items={items} onValueChange={() => {}} />)

  const trigger = screen.getByRole('combobox', { name: 'Contractor' })
  expect(trigger).toHaveAttribute('aria-label', 'Contractor')
  expect(trigger).toHaveAttribute('title', 'GreenLoop Recycling')
  expect(trigger).toHaveTextContent('GreenLoop Recycling')
})

test('shows a visible label in inline mode', () => {
  render(
    <FilterSelect
      label="Sort by:"
      labelMode="inline"
      value="all"
      items={items}
      onValueChange={() => {}}
    />,
  )

  expect(screen.getByText('Sort by:')).toBeVisible()
  const trigger = screen.getByLabelText('Sort by:')
  expect(trigger).not.toHaveAttribute('aria-label')
  expect(trigger).toHaveTextContent('All Contractors')
})
