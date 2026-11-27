export interface Greeting {
  message: string
}

export interface ResaleStoreSummary {
  id: number
  name: string
  actual_value: number
}

export interface ResaleStoreSummaryResponse {
  stores: ResaleStoreSummary[]
}

export interface DirectResaleBinRecord {
  id: number
  bin_code: string
  item_count: number
  total_weight_kg: number
  packed_at: string
  status: 'awaiting_process' | 'processed'
  accepted_item_count: number | null
  rejected_item_count: number | null
  revenue: number | null
  processed_at: string | null
  notes: string | null
}

export interface ProcessDirectResaleBinRequest {
  actor_id: number
  accepted_item_count: number
  rejected_item_count: number
  revenue: number
  processed_at: string
  notes?: string
}

export type BinType = 'resale' | 'recycle' | 'repair'
// 'active' accepts items; sealing makes a recycling bin 'ready' for handoff, others 'closed'.
export type BinStatus = 'active' | 'ready' | 'handed_off' | 'closed'
export type GarmentCondition = 'good_reusable' | 'worn_recyclable' | 'repair_upcycle'

export interface GarmentSortRequest {
  actor_id: number
  condition: GarmentCondition
  category?: string
  weight_kg?: number
  notes?: string
  bin_id?: number
}

export interface GarmentItem {
  id: number
  site_id: number
  site_name: string
  condition: GarmentCondition
  category: string
  bin_id: number
  bin_code: string
  weight_kg: number | null
  notes: string | null
  created_at: string
}

export interface BinRecord {
  id: number
  site_id: number
  site_name: string
  bin_code: string
  bin_type: BinType
  status: BinStatus
  item_count: number
  total_weight_kg: number
  max_capacity: number
  created_at: string
  ready_at: string | null
  closed_at: string | null
  notes: string | null
}

export interface BinCreateRequest {
  actor_id: number
  bin_type: BinType
  bin_code?: string
  max_capacity?: number
  notes?: string
}

export interface ActiveBinsResponse {
  resale_bin: BinRecord | null
  recycle_bin: BinRecord | null
  repair_bin: BinRecord | null
}

export interface SortingStatsResponse {
  total_sorted_today: number
  resale_count: number
  recycle_count: number
  repair_count: number
  resale_percentage: number
  active_resale_bin_code: string | null
  active_resale_bin_items: number
  active_recycle_bin_code: string | null
  active_recycle_bin_items: number
  active_repair_bin_code: string | null
  active_repair_bin_items: number
}

export interface SortGarmentResponse {
  garment: GarmentItem
  bin: BinRecord
  message: string
}

export type DashboardFrequency = 'monthly' | 'quarterly' | 'annual'
export type DashboardExceptionStatus = 'pending' | 'disputed'

export interface DashboardFilters {
  frequency: DashboardFrequency
  year: number
  month?: number
  quarter?: number
  site_id?: number
  contractor_id?: number
}

export interface DashboardSiteOption {
  id: number
  code: string
  name: string
}

export interface DashboardContractorOption {
  id: number
  name: string
  /** Inactive contractors stay in the filter so their past data can still be viewed. */
  is_active: boolean
}

export interface DashboardSummary {
  recycling_bins_collected: number
  recycling_bins_reported: number
  pending_bins: number
  disputed_handoffs: number
  recovery_rate: number
  diverted_weight_kg: number
  total_recorded_weight_kg: number
  total_reported_weight_kg: number
  weight_variance_kg: number
}

export interface DashboardOutcome {
  category:
    | 'upcycled'
    | 'fibre_to_fibre'
    | 'downcycled'
    | 'exported'
    | 'landfilled'
    | 'incinerated_energy_recovery'
  weight_kg: number
  percentage: number
}

export interface DashboardMonthlyOutcome {
  month: number
  month_label: string
  upcycled: number
  fibre_to_fibre: number
  downcycled: number
  exported: number
  landfilled: number
  incinerated_energy_recovery: number
}

export interface DashboardException {
  handoff_id: number
  bin_code: string
  contractor_name: string
  handoff_date: string
  item_count: number
  staff_weight_kg: number
  driver_weight_kg: number
  variance_percent: number
  has_contractor_report: boolean
  status: DashboardExceptionStatus
}

export interface DashboardResponse {
  frequency: DashboardFrequency
  year: number
  month: number | null
  quarter: number | null
  period_label: string
  summary: DashboardSummary
  outcomes: DashboardOutcome[]
  monthly_outcomes: DashboardMonthlyOutcome[]
  exceptions: DashboardException[]
  filters: {
    sites: DashboardSiteOption[]
    contractors: DashboardContractorOption[]
    available_years: number[]
  }
}

export interface EprQuarterReport {
  year: number
  quarter: number
  source: 'live_records' | 'submitted_snapshot'
  total_weight_received_kg: number
  resold_weight_kg: number
  repaired_weight_kg: number
  upcycled_weight_kg: number
  fibre_to_fibre_weight_kg: number
  downcycled_weight_kg: number
  exported_weight_kg: number
  landfilled_weight_kg: number
  incinerated_energy_recovery_weight_kg: number
  uncategorized_weight_kg: number
  excess_weight_kg: number
  recovery_rate_percent: number
  garments_missing_weight: number | null
}

export type EprAdjustmentMetric =
  | 'total_received'
  | 'resold'
  | 'repaired'
  | 'upcycled'
  | 'fibre_to_fibre'
  | 'downcycled'
  | 'exported'
  | 'landfilled'
  | 'incinerated_energy_recovery'

export interface EprAdjustmentRequest {
  actor_id: number
  site_id: number
  expected_latest_adjustment_id: number | null
  effective_date: string
  reason: string
  lines: { metric: EprAdjustmentMetric; weight_delta_kg: string }[]
}

export interface EprManagementOption {
  id: number
  label: string
}

export interface EprManagement {
  report: EprQuarterReport
  status: 'draft' | 'submitted'
  submitted_at: string | null
  submitted_by: string | null
  adjusted_report: EprQuarterReport | null
  adjustments: {
    id: number
    site_id: number
    metric: EprAdjustmentMetric
    weight_delta_kg: number
    effective_date: string
    reason: string
    created_at: string
    recorded_by: string
  }[]
  sites: EprManagementOption[]
  actors: EprManagementOption[]
}

const API_URL = import.meta.env.VITE_API_URL ?? ''

/** A failed request. `detail` is the server's own explanation, when it sent one. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string | null

  constructor(status: number, body: string, statusText: string) {
    super(`API request failed (${status}): ${body || statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = readDetail(body)
  }
}

// FastAPI sends `{"detail": "..."}`, or a list of `{msg}` objects for validation errors.
function readDetail(body: string): string | null {
  try {
    const { detail } = JSON.parse(body) as { detail?: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const messages = detail.map((item: { msg?: unknown }) => item.msg)
      return messages.filter((msg) => typeof msg === 'string').join('. ') || null
    }
  } catch {
    // Not JSON.
  }
  return null
}

async function toApiError(response: Response) {
  return new ApiError(response.status, await response.text(), response.statusText)
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response)
  return response.json() as Promise<T>
}

export async function getGreeting(): Promise<Greeting> {
  const response = await fetch(`${API_URL}/api/greeting`)
  return handleResponse<Greeting>(response)
}

export async function getResaleStoreSummary(
  signal?: AbortSignal,
): Promise<ResaleStoreSummaryResponse> {
  const response = await fetch(`${API_URL}/api/resale-bins/summary`, { signal })
  return handleResponse<ResaleStoreSummaryResponse>(response)
}

export async function getDashboard(
  filters: DashboardFilters,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const params = new URLSearchParams({
    frequency: filters.frequency,
    year: String(filters.year),
  })
  if (filters.month !== undefined) {
    params.set('month', String(filters.month))
  }
  if (filters.quarter !== undefined) {
    params.set('quarter', String(filters.quarter))
  }
  if (filters.site_id !== undefined) {
    params.set('site_id', String(filters.site_id))
  }
  if (filters.contractor_id !== undefined) {
    params.set('contractor_id', String(filters.contractor_id))
  }

  const response = await fetch(`${API_URL}/api/dashboard?${params.toString()}`, { signal })
  return handleResponse<DashboardResponse>(response)
}

export async function getEprQuarterReport(
  year: number,
  quarter: number,
  signal?: AbortSignal,
): Promise<EprQuarterReport> {
  const params = new URLSearchParams({ year: String(year), quarter: String(quarter) })
  const response = await fetch(`${API_URL}/api/epr/quarterly-report?${params}`, { signal })
  return handleResponse<EprQuarterReport>(response)
}

export async function getEprManagement(year: number, quarter: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ year: String(year), quarter: String(quarter) })
  const response = await fetch(`${API_URL}/api/epr/quarterly-report/management?${params}`, {
    signal,
  })
  return handleResponse<EprManagement>(response)
}

async function writeEprManagement(
  action: 'submit' | 'adjustments',
  year: number,
  quarter: number,
  payload: { actor_id: number } | EprAdjustmentRequest,
) {
  const params = new URLSearchParams({ year: String(year), quarter: String(quarter) })
  const response = await fetch(`${API_URL}/api/epr/quarterly-report/${action}?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: unknown } | null
    if (typeof error?.detail === 'string') throw new Error(error.detail)
    throw new Error('The report could not be saved. Check the entered values and try again.')
  }
  return handleResponse<EprManagement>(response)
}

export function submitEprQuarter(year: number, quarter: number, actorId: number) {
  return writeEprManagement('submit', year, quarter, { actor_id: actorId })
}

export function saveEprAdjustment(year: number, quarter: number, payload: EprAdjustmentRequest) {
  return writeEprManagement('adjustments', year, quarter, payload)
}

// Sorting reads are per site and writes name the acting staff member (`actor_id`) until the
// frontend uses real login, the same stopgap the handoff pages use.
async function sortingRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, init)
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: unknown } | null
    if (typeof error?.detail === 'string') throw new Error(error.detail)
    throw new Error('The sorting request failed. Check the entered values and try again.')
  }
  return response.json() as Promise<T>
}

function postJson<T>(path: string, body: unknown) {
  return sortingRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// Reads name the acting user (`actor_id`). Staff only reach their own site; managers pick one of
// their sites, or leave `siteId` out for all of them combined (the list endpoints only).
export function getSortingStats(actorId: number, siteId?: number): Promise<SortingStatsResponse> {
  return sortingRequest<SortingStatsResponse>(
    `/sorting/stats${buildQuery({ actor_id: actorId, site_id: siteId })}`,
  )
}

/** The sites this user may read, for the manager's site switcher. */
export function getSortingSites(actorId: number): Promise<Store[]> {
  return sortingRequest<Store[]>(`/sorting/sites${buildQuery({ actor_id: actorId })}`)
}

export function getActiveBins(actorId: number, siteId?: number): Promise<ActiveBinsResponse> {
  return sortingRequest<ActiveBinsResponse>(
    `/bins/active${buildQuery({ actor_id: actorId, site_id: siteId })}`,
  )
}

export function getBins(
  actorId: number,
  siteId?: number,
  filters?: { bin_type?: BinType; status?: BinStatus },
): Promise<BinRecord[]> {
  return sortingRequest<BinRecord[]>(
    `/bins${buildQuery({ actor_id: actorId, site_id: siteId, ...filters })}`,
  )
}

export function getDirectResaleBins(siteId: number, signal?: AbortSignal) {
  return sortingRequest<DirectResaleBinRecord[]>(`/resale-bins${buildQuery({ site_id: siteId })}`, {
    signal,
  })
}

export function processDirectResaleBin(binId: number, payload: ProcessDirectResaleBinRequest) {
  return postJson<DirectResaleBinRecord>(`/resale-bins/${binId}/process`, payload)
}

export function createBin(payload: BinCreateRequest): Promise<BinRecord> {
  return postJson<BinRecord>('/bins', payload)
}

export function closeBin(binId: number, actorId: number, notes?: string): Promise<BinRecord> {
  return postJson<BinRecord>(`/bins/${binId}/close`, { actor_id: actorId, notes })
}

export function sortGarment(payload: GarmentSortRequest): Promise<SortGarmentResponse> {
  return postJson<SortGarmentResponse>('/garments/sort', payload)
}

export function getRecentGarments(
  actorId: number,
  siteId?: number,
  limit = 15,
): Promise<GarmentItem[]> {
  return sortingRequest<GarmentItem[]>(
    `/garments/recent${buildQuery({ actor_id: actorId, site_id: siteId, limit })}`,
  )
}

export type UserRole = 'admin' | 'manager' | 'staff'

export interface Store {
  id: number
  code: string
  name: string
}

export interface User {
  id: number
  username: string
  role: UserRole
  full_name: string | null
  must_change_password: boolean
  store: Store | null
}

// Returned once when the server generates a password; it is never returned again.
export interface UserWithTemporaryPassword extends User {
  temporary_password: string | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

// Omit `password` to have the server generate a temporary one. Staff need a `site_id`,
// managers may have one, administrators must not.
export interface UserCreateRequest {
  username: string
  password?: string
  role: UserRole
  full_name?: string | null
  site_id?: number | null
}

// Omitted fields are unchanged. `full_name: null` clears the name and `site_id: null`
// removes the store (not allowed for staff).
export interface UserUpdateRequest {
  username?: string
  password?: string
  role?: UserRole
  full_name?: string | null
  site_id?: number | null
}

let onUnauthorized: (token: string) => void = () => {}

/** Called with the rejected token whenever a signed-in request gets a `401`. */
export function setUnauthorizedHandler(handler: (token: string) => void) {
  onUnauthorized = handler
}

async function authFetch(token: string, path: string, method = 'GET', body?: unknown) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) onUnauthorized(token)
  if (!response.ok) throw await toApiError(response)
  return response
}

async function authRequest<T>(token: string, path: string, method?: string, body?: unknown) {
  const response = await authFetch(token, path, method, body)
  return response.json() as Promise<T>
}

// A `401` here means wrong credentials, not an expired session.
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handleResponse<LoginResponse>(response)
}

export function getCurrentUser(token: string) {
  return authRequest<User>(token, '/auth/me')
}

export function listUsers(token: string, offset = 0, limit = 100) {
  return authRequest<User[]>(token, `/users?offset=${offset}&limit=${limit}`)
}

export function createUser(token: string, payload: UserCreateRequest) {
  return authRequest<UserWithTemporaryPassword>(token, '/users', 'POST', payload)
}

export function resetUserPassword(token: string, userId: number) {
  return authRequest<UserWithTemporaryPassword>(token, `/users/${userId}/reset-password`, 'POST')
}

export function listSites(token: string) {
  return authRequest<Store[]>(token, '/sites')
}

export function changePassword(token: string, currentPassword: string, newPassword: string) {
  return authRequest<User>(token, '/auth/change-password', 'POST', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export function updateUser(token: string, userId: number, payload: UserUpdateRequest) {
  return authRequest<User>(token, `/users/${userId}`, 'PATCH', payload)
}

export async function deleteUser(token: string, userId: number): Promise<void> {
  await authFetch(token, `/users/${userId}`, 'DELETE')
}

export interface Contractor {
  id: number
  name: string
  contact_name: string | null
  contact_email: string | null
  is_active: boolean
}

// Names are unique regardless of letter case. Blank contact details are saved as null.
export interface ContractorCreateRequest {
  name: string
  contact_name?: string | null
  contact_email?: string | null
}

// Omitted fields are unchanged. `contact_name: null` and `contact_email: null` clear them.
export interface ContractorUpdateRequest {
  name?: string
  contact_name?: string | null
  contact_email?: string | null
  is_active?: boolean
}

export function listContractors(token: string) {
  return authRequest<Contractor[]>(token, '/contractors')
}

export function createContractor(token: string, payload: ContractorCreateRequest) {
  return authRequest<Contractor>(token, '/contractors', 'POST', payload)
}

export function updateContractor(
  token: string,
  contractorId: number,
  payload: ContractorUpdateRequest,
) {
  return authRequest<Contractor>(token, `/contractors/${contractorId}`, 'PATCH', payload)
}

// Fails with a `409` when the contractor has handoffs or reports; deactivate it instead.
export async function deleteContractor(token: string, contractorId: number): Promise<void> {
  await authFetch(token, `/contractors/${contractorId}`, 'DELETE')
}

export interface ContractorReportOptionItem {
  id: number
  name: string
}

export interface ContractorReportOptionsResponse {
  contractors: ContractorReportOptionItem[]
}

export interface ContractorDispositionWeightsPayload {
  upcycled_kg: number
  fibre_to_fibre_kg: number
  downcycled_kg: number
  exported_kg: number
  landfilled_kg: number
  incinerated_energy_recovery_kg: number
}

export interface ContractorReportParsedRow {
  /** The spreadsheet line number; the header is line 1. */
  row: number
  bin_id: string
  /** The bin's sorting center, or null when the bin wasn't found. */
  site_name: string | null
  /** Weighed by store staff at pickup, from the bin's handoff. */
  staff_weight_kg: number | null
  received_kg: number
  dispositions: ContractorDispositionWeightsPayload
  categorized_weight_kg: number
  uncategorized_weight_kg: number
  status: 'Verified' | 'Warning' | 'Error'
  /** Why the row is rejected; empty unless the status is Error. */
  errors: string[]
  /** What to check before saving; the row can still be saved. */
  warnings: string[]
}

export interface ContractorReportFileParseResponse {
  filename: string
  rows: ContractorReportParsedRow[]
}

export interface ContractorReportImportRequest {
  /** The signed-in manager or admin, recorded as the uploader. */
  actor_id: number
  contractor_id: number
  report_month: string
  source_filename: string
  rows: Array<{
    row: number
    bin_id: string
    received_kg: number
    dispositions: ContractorDispositionWeightsPayload
  }>
}

export interface ContractorReportImportSiteResult {
  report_id: number
  site_id: number
  site_name: string
  imported_rows: number
}

export interface ContractorReportImportResponse {
  /** One saved report per sorting center found in the file. */
  reports: ContractorReportImportSiteResult[]
  contractor_name: string
  report_month: string
  imported_rows: number
  total_received_kg: number
  total_categorized_weight_kg: number
  message: string
}

const IMPORT_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function parseImportApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const data = (await response.json()) as { detail?: string }
      if (data.detail) {
        detail = data.detail
      }
    } catch {
      // keep default detail
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export async function fetchContractorReportOptions(): Promise<ContractorReportOptionsResponse> {
  const response = await fetch(`${IMPORT_API_BASE}/api/contractor-reports/options`)
  return parseImportApiResponse<ContractorReportOptionsResponse>(response)
}

export interface ContractorReportFileParseInput {
  /** The signed-in manager or admin. */
  actorId: number
  filename: string
  contentBase64: string
  /** Rows not picked up in this month (YYYY-MM) are rejected. */
  reportMonth: string
  /** Rows handed off to another contractor are rejected. */
  contractorId: number
}

export async function parseAndValidateContractorFile(
  input: ContractorReportFileParseInput,
): Promise<ContractorReportFileParseResponse> {
  const response = await fetch(`${IMPORT_API_BASE}/api/contractor-reports/parse-and-validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actor_id: input.actorId,
      filename: input.filename,
      content_base64: input.contentBase64,
      report_month: input.reportMonth,
      contractor_id: input.contractorId,
    }),
  })
  return parseImportApiResponse<ContractorReportFileParseResponse>(response)
}

export async function importContractorReport(
  payload: ContractorReportImportRequest,
): Promise<ContractorReportImportResponse> {
  const response = await fetch(`${IMPORT_API_BASE}/api/contractor-reports/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseImportApiResponse<ContractorReportImportResponse>(response)
}

// Recycle bin handoff. Mirrors the "Recycle bin handoff" section of backend/app/schemas.py.

export type HandoffRecordStatus = 'scheduled' | 'picked_up' | 'disputed' | 'approved' | 'closed'

export interface HandoffSiteOption {
  id: number
  code: string
  name: string
}

export interface HandoffContractorOption {
  id: number
  name: string
}

export interface HandoffActorOption {
  id: number
  username: string
  role: UserRole
  site_ids: number[]
}

export interface HandoffOptions {
  sites: HandoffSiteOption[]
  contractors: HandoffContractorOption[]
  actors: HandoffActorOption[]
}

export interface HandoffReadyBin {
  id: number
  site_id: number
  site_name: string
  code: string
  item_count: number
  total_weight_kg: number
  ready_at: string | null
}

export interface HandoffReadyBinsResponse {
  bins: HandoffReadyBin[]
}

export interface HandoffOutcomes {
  upcycled_weight_kg: number
  fibre_to_fibre_weight_kg: number
  downcycled_weight_kg: number
  exported_weight_kg: number
  landfilled_weight_kg: number
  incinerated_energy_recovery_weight_kg: number
}

export interface HandoffRecord {
  id: number
  site_id: number
  site_name: string
  bin_id: number
  bin_code: string
  item_count: number
  bin_weight_kg: number
  contractor_id: number
  contractor_name: string
  status: HandoffRecordStatus
  scheduled_pickup_at: string | null
  picked_up_at: string | null
  staff_weight_kg: number | null
  driver_weight_kg: number | null
  weight_variance_percent: number | null
  requires_manager_approval: boolean
  // An API path (/api/handoffs/{id}/scale-photo) for uploaded photos, or an external URL.
  scale_photo_url: string | null
  driver_name: string | null
  vehicle_plate_number: string | null
  created_by: string
  approved_by: string | null
  approved_at: string | null
  closed_at: string | null
  outcomes: HandoffOutcomes | null
}

export interface HandoffListResponse {
  handoffs: HandoffRecord[]
}

export interface HandoffPickupRequest {
  bin_id: number
  contractor_id: number
  actor_id: number
  // ISO 8601 with a UTC offset, not in the future.
  picked_up_at: string
  staff_weight_kg: number
  driver_weight_kg: number
  driver_name: string
  vehicle_plate_number: string
  // JPEG, PNG, or WebP, up to 5 MB.
  scale_photo: Blob
}

async function handoffRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api/handoffs${path}`, init)
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { detail?: unknown } | null
    if (typeof error?.detail === 'string') throw new Error(error.detail)
    throw new Error('The handoff request failed. Check the entered values and try again.')
  }
  return response.json() as Promise<T>
}

function postHandoffJson<T>(path: string, payload: unknown) {
  return handoffRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

export function getHandoffOptions(signal?: AbortSignal) {
  return handoffRequest<HandoffOptions>('/options', { signal })
}

export function getHandoffReadyBins(siteId?: number, signal?: AbortSignal) {
  return handoffRequest<HandoffReadyBinsResponse>(`/bins${buildQuery({ site_id: siteId })}`, {
    signal,
  })
}

export function getHandoffs(
  filters: { site_id?: number; status?: HandoffRecordStatus } = {},
  signal?: AbortSignal,
) {
  return handoffRequest<HandoffListResponse>(buildQuery(filters), { signal })
}

/** Creates a handoff and records its pickup evidence in one step, when the driver arrives. */
export function recordHandoffAtPickup(payload: HandoffPickupRequest) {
  const form = new FormData()
  form.set('bin_id', String(payload.bin_id))
  form.set('contractor_id', String(payload.contractor_id))
  form.set('actor_id', String(payload.actor_id))
  form.set('picked_up_at', payload.picked_up_at)
  form.set('staff_weight_kg', String(payload.staff_weight_kg))
  form.set('driver_weight_kg', String(payload.driver_weight_kg))
  form.set('driver_name', payload.driver_name)
  form.set('vehicle_plate_number', payload.vehicle_plate_number)
  form.set('scale_photo', payload.scale_photo)
  // No Content-Type header: the browser adds the multipart boundary itself.
  return handoffRequest<HandoffRecord>('/pickups', { method: 'POST', body: form })
}

/** Makes an uploaded scale photo path usable when VITE_API_URL points at another origin. */
export function handoffPhotoUrl(url: string | null) {
  if (!url) return null
  return url.startsWith('/api/') ? `${API_URL}${url}` : url
}

export function approveHandoff(handoffId: number, actorId: number) {
  return postHandoffJson<HandoffRecord>(`/${handoffId}/approve`, { actor_id: actorId })
}

export function closeHandoff(handoffId: number, actorId: number) {
  return postHandoffJson<HandoffRecord>(`/${handoffId}/close`, { actor_id: actorId })
}
