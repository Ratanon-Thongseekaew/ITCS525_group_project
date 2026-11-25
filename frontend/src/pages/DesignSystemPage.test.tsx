/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import App from '@/App'
import { stubRadixBrowserApis } from '@/test/handoff-fixtures'

beforeEach(() => {
  stubRadixBrowserApis()
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('shows every primitive in a light and a dark panel at /design-system', () => {
  render(
    <MemoryRouter initialEntries={['/design-system']}>
      <App />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Textile Track design system' })).toBeInTheDocument()
  expect(screen.getByTestId('design-system-light-panel')).not.toHaveClass('dark')
  expect(screen.getByTestId('design-system-dark-panel')).toHaveClass('dark')
  expect(screen.getByRole('heading', { name: 'Light theme' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dark theme' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Open dialog' })).toHaveLength(2)
  expect(screen.getAllByRole('table')).toHaveLength(2)
  expect(screen.getAllByText('Disputed')).toHaveLength(2)
  // The page is unlisted, so the workspace sidebar is not rendered.
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})
