/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { sessionUser, signInAs } from './test/auth'
import { dashboardFixture } from './test/dashboard-fixture'
import { handoffOptions, handoffRecord, readyBin } from './test/handoff-fixtures'
import App from './App'
import { isWorkspaceRole } from './types/workspace'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  resaleBins.splice(0, resaleBins.length, ...initialResaleBins.map((bin) => ({ ...bin })))
  vi.useRealTimers()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

const handoffBins = [
  readyBin({ id: 1, code: 'bin-id-001', item_count: 100, total_weight_kg: 40 }),
  readyBin({ id: 2, code: 'bin-id-002', item_count: 100, total_weight_kg: 40 }),
]
const handoffRecords = [
  handoffRecord({ id: 1, bin_code: 'bin-id-001' }),
  handoffRecord({
    id: 2,
    bin_code: 'bin-id-002',
    status: 'closed',
    picked_up_at: '2026-10-16T11:00:00Z',
    staff_weight_kg: 40,
    outcomes: {
      upcycled_weight_kg: 5,
      fibre_to_fibre_weight_kg: 15,
      downcycled_weight_kg: 10,
      exported_weight_kg: 5,
      landfilled_weight_kg: 3,
      incinerated_energy_recovery_weight_kg: 1,
    },
  }),
]

const initialResaleBins = [
  {
    id: 1,
    bin_code: 'RS-001',
    item_count: 100,
    total_weight_kg: 40,
    packed_at: '2026-10-01T15:31:00Z',
    status: 'awaiting_process',
    accepted_item_count: null,
    rejected_item_count: null,
    revenue: null,
    processed_at: null,
    notes: null,
  },
  {
    id: 2,
    bin_code: 'RS-002',
    item_count: 80,
    total_weight_kg: 32,
    packed_at: '2026-09-28T10:15:00Z',
    status: 'processed',
    accepted_item_count: 78,
    rejected_item_count: 2,
    revenue: 12000,
    processed_at: '2026-10-10',
    notes: null,
  },
  {
    id: 3,
    bin_code: 'RS-003',
    item_count: 120,
    total_weight_kg: 45,
    packed_at: '2026-09-25T14:05:00Z',
    status: 'processed',
    accepted_item_count: 118,
    rejected_item_count: 2,
    revenue: 18500,
    processed_at: '2026-10-12',
    notes: null,
  },
]
const resaleBins: typeof initialResaleBins = initialResaleBins.map((bin) => ({ ...bin }))

function fixtureFor(url: string) {
  if (url.includes('/api/auth/me')) return sessionUser()
  if (url.includes('/api/users') || url.includes('/api/sites')) return []
  if (url.includes('/api/dashboard')) return dashboardFixture
  if (url.includes('/api/handoffs/options')) return handoffOptions
  if (url.includes('/api/handoffs/bins')) return { bins: handoffBins }
  if (url.includes('/api/handoffs')) {
    return { handoffs: url.includes('status=disputed') ? [] : handoffRecords }
  }
  if (url.includes('/api/resale-bins')) return resaleBins
  return { message: 'Hello from FastAPI!' }
}

/** The workspace sidebar, so its links aren't confused with a page's breadcrumb links. */
function sidebar() {
  return within(document.querySelector<HTMLElement>('[data-sidebar="sidebar"]')!)
}

/** Renders a route signed in as the role its path belongs to; other routes start signed out. */
function renderRoute(route: string) {
  const pathRole = route.split('/')[1]
  window.sessionStorage.clear()
  if (isWorkspaceRole(pathRole)) signInAs(pathRole)

  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input)
    if (init?.method === 'POST' && url.includes('/api/resale-bins/') && url.endsWith('/process')) {
      const binId = Number(url.split('/').at(-2))
      const payload = JSON.parse(String(init.body)) as {
        accepted_item_count: number
        rejected_item_count: number
        revenue: number
        processed_at: string
        notes?: string
      }
      const bin = resaleBins.find((item) => item.id === binId)
      if (bin) Object.assign(bin, { ...payload, status: 'processed' })
    }
    return Promise.resolve(
      new Response(JSON.stringify(fixtureFor(url)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

function renderDirectResaleRoute(route: string) {
  renderRoute(route)
}

test('renders the garment sorting workspace at the staff sorting route', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('heading', { name: 'Your work, clearly organized.' })).toBeInTheDocument()
})

test('renders user management immediately when visited directly', () => {
  renderRoute('/admin/users')

  expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'loading...' })).not.toBeInTheDocument()
})

test('offers the theme picker in the workspace header and on the login page', () => {
  renderRoute('/admin/users')
  expect(screen.getByRole('button', { name: 'Change color theme' })).toBeInTheDocument()
  cleanup()

  renderRoute('/login')
  expect(screen.getByRole('button', { name: 'Change color theme' })).toBeInTheDocument()
})

test('redirects the manager root to the compliance dashboard', () => {
  renderRoute('/manager')

  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.queryByRole('status', { name: 'loading...' })).not.toBeInTheDocument()
})

test('navigates from the manager workspace to the compliance dashboard path', async () => {
  renderRoute('/manager/resale-bins')

  fireEvent.click(screen.getByRole('link', { name: 'Compliance Dashboard' }))

  const complianceDashboardLink = screen.getByRole('link', { name: 'Compliance Dashboard' })

  expect(complianceDashboardLink).toHaveAttribute('href', '/manager/compliance-dashboard')
  expect(complianceDashboardLink).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(await screen.findByText('Recycling Bins Collected')).toBeInTheDocument()
  expect(screen.getByRole('table')).toBeInTheDocument()
})

test('renders and processes a direct resale bin', async () => {
  renderDirectResaleRoute('/staff/direct-resale')

  expect(screen.getByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Signed-in staff account' })).toHaveTextContent(
    'Test staff',
  )
  expect(screen.getByRole('group', { name: 'Signed-in staff account' })).toHaveTextContent(
    'Siam Square',
  )
  expect(screen.queryByLabelText('Staff member')).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: /#RS-001/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Sale Revenue (฿)'), { target: { value: '15000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(
    await screen.findByText('No closed resale bins are waiting to be processed.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /#RS-001/i })).not.toBeInTheDocument()
  const processCall = vi
    .mocked(globalThis.fetch)
    .mock.calls.find(
      ([input, init]) => String(input).includes('/api/resale-bins/') && init?.method === 'POST',
    )
  expect(processCall).toBeDefined()
  expect(JSON.parse(String(processCall?.[1]?.body))).toMatchObject({ actor_id: 99 })
})

test('uses the signed-in staff account and store instead of the temporary account picker', async () => {
  renderDirectResaleRoute('/staff/direct-resale')

  expect(await screen.findByText('#RS-001')).toBeInTheDocument()
  expect(screen.queryByText('staff.bkk@example.com')).not.toBeInTheDocument()
  expect(
    vi
      .mocked(globalThis.fetch)
      .mock.calls.some(([input]) => String(input).includes('/api/resale-bins?site_id=1')),
  ).toBe(true)
  expect(
    vi
      .mocked(globalThis.fetch)
      .mock.calls.some(([input]) => String(input).includes('/api/handoffs/options')),
  ).toBe(false)
})

test('keeps accepted and rejected counts equal to the bin item total', async () => {
  renderDirectResaleRoute('/staff/direct-resale')

  fireEvent.click(await screen.findByRole('button', { name: /#RS-001/i }))
  const accepted = screen.getByLabelText('Accepted Item Count')
  const rejected = screen.getByLabelText('Rejected Item Count')

  fireEvent.change(rejected, { target: { value: '2' } })
  expect(accepted).toHaveValue(98)
  expect(rejected).toHaveValue(2)

  fireEvent.change(accepted, { target: { value: '90' } })
  expect(accepted).toHaveValue(90)
  expect(rejected).toHaveValue(10)
})

test('links Direct Resale to its revenue summary and processed history', () => {
  renderDirectResaleRoute('/staff/direct-resale')

  expect(screen.getByRole('link', { name: 'Revenue Summary' })).toHaveAttribute(
    'href',
    '/staff/direct-resale/potential-revenue-analysis',
  )
  expect(screen.getByRole('link', { name: 'Processed Bin Records' })).toHaveAttribute(
    'href',
    '/staff/direct-resale/processed-bins-record',
  )
})

test('lists processed resale bins on their own page', async () => {
  renderDirectResaleRoute('/staff/direct-resale/processed-bins-record')

  expect(screen.getByRole('heading', { name: 'Processed Bin Records' })).toBeInTheDocument()
  expect(await screen.findByText('#RS-002')).toBeInTheDocument()
  expect(await screen.findByText('#RS-003')).toBeInTheDocument()
  expect(screen.queryByText('#RS-001')).not.toBeInTheDocument()
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /#bin-id-002/i })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to bins' })).toHaveAttribute(
    'href',
    '/staff/direct-resale',
  )
  const directResaleLinks = screen.getAllByRole('link', { name: 'Direct Resale' })
  expect(directResaleLinks.some((link) => link.getAttribute('data-active') === 'true')).toBe(true)
})

test('renders potential revenue analysis from processed resale bins', async () => {
  renderDirectResaleRoute('/staff/direct-resale/potential-revenue-analysis')

  expect(screen.getByRole('heading', { name: 'Potential Revenue Analysis' })).toBeInTheDocument()
  expect(await screen.findByText('฿30,500')).toBeInTheDocument()
  expect(screen.getByText('2 processed bins')).toBeInTheDocument()
  const directResaleLinks = screen.getAllByRole('link', { name: 'Direct Resale' })
  expect(directResaleLinks.some((link) => link.getAttribute('data-active') === 'true')).toBe(true)
  expect(screen.getByRole('link', { name: 'Back to bins' })).toHaveAttribute(
    'href',
    '/staff/direct-resale',
  )
})

test('shows a just-processed bin in revenue summary and processed history', async () => {
  renderDirectResaleRoute('/staff/direct-resale')

  fireEvent.click(await screen.findByRole('button', { name: /#RS-001/i }))
  fireEvent.change(screen.getByLabelText('Sale Revenue (฿)'), { target: { value: '15000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(await screen.findByRole('link', { name: 'Revenue Summary' }))

  expect(await screen.findByText('฿45,500')).toBeInTheDocument()
  expect(screen.getByText('3 processed bins')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Back to bins' }))
  fireEvent.click(screen.getByRole('link', { name: 'Processed Bin Records' }))

  expect(await screen.findByText('#RS-001')).toBeInTheDocument()
  expect(screen.getByText('฿15,000')).toBeInTheDocument()
})

test('renders the login page at the root route', () => {
  renderRoute('/')

  expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  expect(screen.getByText('Welcome back')).toBeInTheDocument()

  const backgroundVideo = document.querySelector('video')
  const videoSource = backgroundVideo?.querySelector('source')

  expect(backgroundVideo).toHaveAttribute('autoplay')
  expect(backgroundVideo).toHaveAttribute('loop')
  expect(backgroundVideo).toHaveAttribute('playsinline')
  expect(videoSource).toHaveAttribute('src', 'https://www.pexels.com/download/video/9594356/')
})

test('toggles password visibility from the login form', () => {
  renderRoute('/')

  const passwordInput = screen.getByLabelText('Password')
  expect(passwordInput).toHaveAttribute('type', 'password')

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))

  expect(passwordInput).toHaveAttribute('type', 'text')
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))

  expect(passwordInput).toHaveAttribute('type', 'password')
})

const staffNavigation = [
  ['Sorting', '/staff/sorting'],
  ['Direct Resale', '/staff/direct-resale'],
  ['Recycle Bin Handoff', '/staff/recycle-bin-handoff'],
] as const

const managerNavigation = [
  'Compliance Dashboard',
  'Sorting Overview',
  'Resale Bin Records',
  'Import Data',
]

test('shows the Figma navigation in the staff sidebar', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toBeInTheDocument()
  for (const [label, href] of staffNavigation) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
  }
  for (const label of [...managerNavigation, 'Recycle Bin Records', 'User Management']) {
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
})

test.each([
  ['/manager', managerNavigation, false],
  ['/admin/users', ['Compliance Dashboard'], true],
])('shows the role sidebar items at %s', (route, visibleNavigation, hasUserManagement) => {
  renderRoute(route)

  for (const label of visibleNavigation) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
  }
  for (const [label] of staffNavigation) {
    expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument()
  }
  expect(screen.queryByRole('link', { name: 'Recycle Bin Records' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'User Management' }) !== null).toBe(hasUserManagement)
})

test('navigates between shared workspace sections from the sidebar', async () => {
  renderRoute('/manager')

  fireEvent.click(screen.getByRole('link', { name: 'Resale Bin Records' }))

  expect(await screen.findByRole('heading', { name: 'Resale Bin Records' })).toBeInTheDocument()
})

test('opens New Bins for Handoff from the staff sidebar', async () => {
  renderRoute('/staff/sorting')

  fireEvent.click(screen.getByRole('link', { name: 'Recycle Bin Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('opens Direct Resale from the staff sidebar', async () => {
  renderRoute('/staff/sorting')

  fireEvent.click(screen.getByRole('link', { name: 'Direct Resale' }))

  expect(await screen.findByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
})

test('renders New Bins for Handoff from the API', async () => {
  renderRoute('/staff/recycle-bin-handoff')

  expect(screen.getByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '#bin-id-001' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-002' })).toBeInTheDocument()
  expect(screen.getByText('Bins Awaiting').nextElementSibling).toHaveTextContent('2')
  expect(screen.getByText('Items Staged').nextElementSibling).toHaveTextContent('200')
  expect(screen.getByText('Total Grossed Weight').nextElementSibling).toHaveTextContent('80 kg')
  expect(screen.getByText('Awaiting Approval').nextElementSibling).toHaveTextContent('0')
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test('navigates to Handoff Records from the handoff page', async () => {
  renderRoute('/staff/recycle-bin-handoff')

  fireEvent.click(screen.getByRole('link', { name: 'Handoff Records' }))

  expect(await screen.findByRole('heading', { name: 'Handoff Records' })).toBeInTheDocument()
})

test('renders Handoff Records from the API', async () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  expect(screen.getByRole('heading', { name: 'Handoff Records' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '#bin-id-001' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '#bin-id-002' })).toBeInTheDocument()
  expect(screen.getByText('Outcome report is still pending!')).toBeInTheDocument()
  expect(screen.getByText('Total Reported').nextElementSibling).toHaveTextContent('39.0 kg')
  expect(screen.getByText('Variance').nextElementSibling).toHaveTextContent('-1.0 kg')
  expect(screen.getByText('Showing 2 of 2 records')).toBeInTheDocument()
})

test('returns to New Bins for Handoff from Handoff Records', async () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  fireEvent.click(screen.getByRole('link', { name: 'Back to Handoff' }))

  expect(await screen.findByRole('heading', { name: 'New Bins for Handoff' })).toBeInTheDocument()
})

test('keeps Recycle Bin Handoff active on its sub-routes', () => {
  renderRoute('/staff/recycle-bin-handoff/handoff-records')

  expect(sidebar().getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'false')
})

test('marks only Sorting active at the sorting route', () => {
  renderRoute('/staff/sorting')

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('link', { name: 'Recycle Bin Handoff' })).toHaveAttribute(
    'data-active',
    'false',
  )
})

test.each([
  ['/staff/sorting', '/staff/sorting'],
  ['/admin/compliance-dashboard', '/admin/users'],
])('links the sidebar logo at %s to %s', (route, href) => {
  renderRoute(route)

  expect(screen.getByRole('link', { name: 'Textile Track dashboard' })).toHaveAttribute(
    'href',
    href,
  )
})

test('renders Direct Resale inside the shared workspace sidebar', () => {
  renderRoute('/staff/direct-resale')

  expect(screen.getByRole('link', { name: 'Sorting' })).toHaveAttribute('href', '/staff/sorting')
  expect(screen.getByRole('link', { name: 'Direct Resale' })).toHaveAttribute('data-active', 'true')
  expect(screen.getByRole('heading', { name: 'Direct Resale Bins' })).toBeInTheDocument()
})

test('shows the compliance dashboard to admins and keeps them in their workspace', () => {
  renderRoute('/admin/compliance-dashboard')

  expect(screen.getByRole('heading', { name: 'Compliance Dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Compliance Dashboard' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(screen.getByRole('button', { name: 'Export EPR Report' })).toHaveAttribute(
    'aria-haspopup',
    'dialog',
  )
})

test('opens the contractor report import page from manager navigation', () => {
  renderRoute('/manager/compliance-dashboard')

  fireEvent.click(screen.getByRole('link', { name: 'Import Data' }))

  expect(
    screen.getByRole('heading', { name: 'Import Monthly Outcome Report File' }),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Sign Out' })).toHaveLength(1)
})
