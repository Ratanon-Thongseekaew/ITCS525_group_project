/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { ModeToggle } from './ModeToggle'
import { ThemeProvider } from './theme-provider'
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
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('style')
  vi.unstubAllGlobals()
})

function chooseTheme(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Change color theme' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitemradio', { name }))
}

test('switches the page to dark mode and remembers the choice', async () => {
  render(
    <ThemeProvider forcedTheme={null}>
      <ModeToggle />
    </ThemeProvider>,
  )

  chooseTheme('Dark')

  await vi.waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  expect(window.localStorage.getItem('theme')).toBe('dark')

  chooseTheme('Light')

  await vi.waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
  expect(window.localStorage.getItem('theme')).toBe('light')
})

test('keeps the app light while the theme is forced', async () => {
  render(
    <ThemeProvider>
      <ModeToggle />
    </ThemeProvider>,
  )

  chooseTheme('Dark')

  await vi.waitFor(() => expect(window.localStorage.getItem('theme')).toBe('dark'))
  expect(document.documentElement).toHaveClass('light')
  expect(document.documentElement).not.toHaveClass('dark')
})
