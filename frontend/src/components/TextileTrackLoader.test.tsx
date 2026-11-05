/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { TextileTrackLoader } from './TextileTrackLoader'

afterEach(cleanup)

test('renders an accessible full-screen loading status with separate logo layers', () => {
  render(<TextileTrackLoader label="Loading garment records" />)

  const status = screen.getByRole('status', { name: 'Loading garment records' })

  expect(status).toHaveClass('min-h-svh', 'bg-[#f8fafc]', 'text-[var(--color-muted)]')
  expect(screen.getByText('Loading garment records')).toBeInTheDocument()
  expect(status.querySelector('.textile-loader__center')).toBeInTheDocument()
  expect(status.querySelector('.textile-loader__arrows')).toBeInTheDocument()
})

test('supports a compact loader with a custom size and hidden label', () => {
  render(<TextileTrackLoader size={64} fullScreen={false} label="" />)

  const status = screen.getByRole('status', { name: 'กำลังโหลด' })
  const mark = status.querySelector<HTMLElement>('.textile-loader__mark')

  expect(status).not.toHaveClass('min-h-svh')
  expect(mark).toHaveStyle('--textile-loader-size: 64px')
  expect(status).not.toHaveTextContent('กำลังโหลดข้อมูล...')
})
