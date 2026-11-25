/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { StatCard } from './StatCard'

afterEach(cleanup)

test('pairs the label and value as a description term and details', () => {
  render(
    <dl>
      <StatCard label="Bins Awaiting" value={3} hint="Across this site" />
    </dl>,
  )

  const label = screen.getByText('Bins Awaiting')
  expect(label.tagName).toBe('DT')
  expect(label.nextElementSibling?.tagName).toBe('DD')
  expect(label.nextElementSibling).toHaveTextContent('3')
  expect(label.nextElementSibling).toHaveTextContent('Across this site')
})

test('renders a footer beside the value', () => {
  render(
    <dl>
      <StatCard
        label="Awaiting Approval"
        value={2}
        tone="destructive"
        footer={<a href="/records">Review</a>}
      />
    </dl>,
  )

  expect(screen.getByText('Awaiting Approval').nextElementSibling).toContainElement(
    screen.getByRole('link', { name: 'Review' }),
  )
})
