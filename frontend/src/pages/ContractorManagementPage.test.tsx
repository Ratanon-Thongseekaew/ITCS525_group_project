/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { Contractor } from '@/api'
import { Toaster } from '@/components/ui/sonner'
import { signInAs } from '@/test/auth'
import { chooseOption, stubRadixBrowserApis } from '@/test/handoff-fixtures'
import { ContractorManagementPage } from './ContractorManagementPage'

function contractor(id: number, name: string, overrides: Partial<Contractor> = {}): Contractor {
  return {
    id,
    name,
    contact_name: 'Ann P.',
    contact_email: `contact${id}@example.com`,
    is_active: true,
    ...overrides,
  }
}

const contractors = [
  contractor(1, 'Alpha Fibre', { contact_name: null, contact_email: null }),
  contractor(2, 'GreenLoop Recycling'),
  contractor(3, 'Old Textiles Co.', { is_active: false }),
]

beforeEach(() => {
  stubRadixBrowserApis()
  // The toaster reads the colour scheme through matchMedia, which jsdom doesn't provide.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  signInAs('admin')
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function renderPage(write?: () => Response) {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
    if (init?.method && init.method !== 'GET') return Promise.resolve(write!())
    return Promise.resolve(json(contractors))
  })
  render(
    <>
      <ContractorManagementPage />
      <Toaster />
    </>,
  )
  await screen.findByRole('table')
  return fetchMock
}

function table() {
  return within(screen.getByRole('table'))
}

function openActions(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Actions for ${name}` }), { key: 'Enter' })
}

function sentBody(fetchMock: Awaited<ReturnType<typeof renderPage>>, method: string) {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === method)
  return JSON.parse(String(call?.[1]?.body))
}

test('lists contractors with their contact and status', async () => {
  await renderPage()

  expect(screen.getByText('3 contractors · 2 active')).toBeInTheDocument()
  const greenLoop = table().getByRole('row', { name: /GreenLoop Recycling/ })
  expect(within(greenLoop).getByText('contact2@example.com')).toBeInTheDocument()
  expect(within(greenLoop).getByText('Active')).toBeInTheDocument()
  const old = table().getByRole('row', { name: /Old Textiles Co\./ })
  expect(within(old).getByText('Inactive')).toBeInTheDocument()
})

test('filters contractors by search and status', async () => {
  await renderPage()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search contractors' }), {
    target: { value: 'contact2' },
  })
  expect(table().queryByText('Alpha Fibre')).not.toBeInTheDocument()
  expect(table().getByText('GreenLoop Recycling')).toBeInTheDocument()

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search contractors' }), {
    target: { value: '' },
  })
  chooseOption('Filter by status', 'Inactive')
  expect(table().queryByText('GreenLoop Recycling')).not.toBeInTheDocument()
  expect(table().getByText('Old Textiles Co.')).toBeInTheDocument()
})

test('validates the add form before sending', async () => {
  const fetchMock = await renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByText('Enter a company name.')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Company name'), {
    target: { value: 'greenloop recycling' },
  })
  fireEvent.change(screen.getByLabelText('Contact email (optional)'), {
    target: { value: 'not-an-email' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
  expect(screen.getByText('A contractor with this name already exists.')).toBeInTheDocument()
  expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
})

test('adds a contractor', async () => {
  const created = contractor(4, 'Beta Cycle', { contact_name: null })
  const fetchMock = await renderPage(() => json(created, 201))

  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: '  Beta Cycle ' } })
  fireEvent.change(screen.getByLabelText('Contact email (optional)'), {
    target: { value: 'Contact4@Example.com' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(await table().findByText('Beta Cycle')).toBeInTheDocument()
  expect(sentBody(fetchMock, 'POST')).toEqual({
    name: 'Beta Cycle',
    contact_name: null,
    contact_email: 'contact4@example.com',
  })
})

test('shows the server message when adding fails', async () => {
  await renderPage(() => json({ detail: 'A contractor with this name already exists' }, 409))

  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'New Name' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))

  expect(await screen.findByText('A contractor with this name already exists')).toBeInTheDocument()
})

test('edits a contractor, sending only what changed', async () => {
  const fetchMock = await renderPage(() =>
    json(contractor(2, 'GreenLoop Recycling', { contact_name: null })),
  )

  openActions('GreenLoop Recycling')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit contractor' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Edit contractor' }))
  fireEvent.change(dialog.getByLabelText('Contact name (optional)'), { target: { value: ' ' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sentBody(fetchMock, 'PATCH')).toEqual({ contact_name: null })
})

test('confirms before deactivating a contractor', async () => {
  const fetchMock = await renderPage(() =>
    json(contractor(2, 'GreenLoop Recycling', { is_active: false })),
  )

  openActions('GreenLoop Recycling')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }))
  const dialog = within(
    screen.getByRole('alertdialog', { name: 'Deactivate GreenLoop Recycling?' }),
  )
  fireEvent.click(dialog.getByRole('button', { name: 'Deactivate' }))

  await waitFor(() => expect(screen.getByText('3 contractors · 1 active')).toBeInTheDocument())
  expect(sentBody(fetchMock, 'PATCH')).toEqual({ is_active: false })
})

test('reactivates an inactive contractor', async () => {
  const fetchMock = await renderPage(() => json(contractor(3, 'Old Textiles Co.')))

  openActions('Old Textiles Co.')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reactivate' }))

  await waitFor(() => expect(screen.getByText('3 contractors · 3 active')).toBeInTheDocument())
  expect(sentBody(fetchMock, 'PATCH')).toEqual({ is_active: true })
})

test('deletes an unused contractor after confirming', async () => {
  await renderPage(() => new Response(null, { status: 204 }))

  openActions('Alpha Fibre')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete contractor' }))
  const dialog = within(screen.getByRole('alertdialog', { name: 'Delete Alpha Fibre?' }))
  fireEvent.click(dialog.getByRole('button', { name: 'Delete contractor' }))

  await waitFor(() => expect(table().queryByText('Alpha Fibre')).not.toBeInTheDocument())
})

test('keeps a contractor with history and explains why it was not deleted', async () => {
  const detail = 'Contractor has handoffs or reports and cannot be deleted. Deactivate it instead.'
  await renderPage(() => json({ detail }, 409))

  openActions('GreenLoop Recycling')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete contractor' }))
  fireEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete contractor' }),
  )

  expect(await screen.findByText(detail)).toBeInTheDocument()
  expect(table().getByText('GreenLoop Recycling')).toBeInTheDocument()
})
