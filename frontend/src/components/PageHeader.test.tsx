/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test } from 'vitest'
import { PageHeader } from './PageHeader'

afterEach(cleanup)

test('renders the title, description, eyebrow, and actions', () => {
  render(
    <MemoryRouter>
      <PageHeader
        eyebrow="Staff workspace"
        title="Processed Bin Records"
        description="Bins with revenue recorded"
        actions={<button type="button">Back</button>}
      />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { level: 1, name: 'Processed Bin Records' })).toBeVisible()
  expect(screen.getByText('Staff workspace')).toBeInTheDocument()
  expect(screen.getByText('Bins with revenue recorded')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).not.toBeInTheDocument()
})

test('links earlier breadcrumbs and marks the last one as the current page', () => {
  render(
    <MemoryRouter>
      <PageHeader
        title="Potential Revenue Analysis"
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Direct Resale', to: '/staff/direct-resale' },
          { label: 'Potential Revenue Analysis' },
        ]}
      />
    </MemoryRouter>,
  )

  const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })

  expect(breadcrumb).toHaveTextContent('Operations/Direct Resale/Potential Revenue Analysis')
  expect(screen.getByRole('link', { name: 'Direct Resale' })).toHaveAttribute(
    'href',
    '/staff/direct-resale',
  )
  expect(screen.queryByRole('link', { name: 'Operations' })).not.toBeInTheDocument()
  expect(breadcrumb.querySelector('[aria-current="page"]')).toHaveTextContent(
    'Potential Revenue Analysis',
  )
})
