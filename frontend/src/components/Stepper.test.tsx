/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Stepper } from './Stepper'

afterEach(cleanup)

const steps = [
  { title: 'Upload', description: 'Choose a file' },
  { title: 'Review' },
  { title: 'Save' },
]

test('marks the current step and checks off earlier ones', () => {
  render(<Stepper steps={steps} current={2} />)

  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(items[1]).toHaveAttribute('aria-current', 'step')
  expect(items[0]).not.toHaveAttribute('aria-current')
  expect(screen.getByLabelText('Completed')).toBeInTheDocument()
  expect(items[2]).toHaveTextContent('3')
})
