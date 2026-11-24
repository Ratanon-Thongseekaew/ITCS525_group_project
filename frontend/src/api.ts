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

export type BinType = 'resale' | 'recycle' | 'repair'
export type BinStatus = 'active' | 'closed'
export type GarmentCondition = 'good_reusable' | 'worn_recyclable' | 'repair_upcycle'

export interface GarmentSortRequest {
  condition: GarmentCondition
  category?: string
  weight_kg?: number
  notes?: string
  bin_id?: string
}

export interface GarmentItem {
  id: string
  condition: GarmentCondition
  category: string
  bin_id: string
  bin_code: string
  weight_kg: number | null
  notes: string | null
  created_at: string
}

export interface BinRecord {
  id: string
  bin_code: string
  bin_type: BinType
  status: BinStatus
  item_count: number
  total_weight_kg: number
  max_capacity: number
  created_at: string
  closed_at: string | null
  notes: string | null
}

export interface BinCreateRequest {
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

export interface ContractorDispositionWeights {
  upcycled_kg: number
  fibre_to_fibre_kg: number
  downcycled_kg: number
  exported_kg: number
  landfilled_kg: number
  incinerated_energy_recovery_kg: number
}

export interface ContractorReportValidationRowRequest {
  row: number
  received_kg: number
  dispositions: ContractorDispositionWeights
}

export interface ContractorReportValidationRowResult {
  row: number
  categorized_weight_kg: number
  uncategorized_weight_kg: number
  is_valid: boolean
  errors: string[]
}

export interface ContractorReportValidationResponse {
  rows: ContractorReportValidationRowResult[]
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`API request failed (${response.status}): ${errorBody || response.statusText}`)
  }
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

export async function validateContractorReport(
  rows: ContractorReportValidationRowRequest[],
): Promise<ContractorReportValidationResponse> {
  const response = await fetch(`${API_URL}/api/contractor-reports/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  return handleResponse<ContractorReportValidationResponse>(response)
}

export async function getSortingStats(): Promise<SortingStatsResponse> {
  const response = await fetch(`${API_URL}/api/sorting/stats`)
  return handleResponse<SortingStatsResponse>(response)
}

export async function getActiveBins(): Promise<ActiveBinsResponse> {
  const response = await fetch(`${API_URL}/api/bins/active`)
  return handleResponse<ActiveBinsResponse>(response)
}

export async function getBins(filters?: {
  bin_type?: BinType
  status?: BinStatus
}): Promise<BinRecord[]> {
  const params = new URLSearchParams()
  if (filters?.bin_type) {
    params.set('bin_type', filters.bin_type)
  }
  if (filters?.status) {
    params.set('status', filters.status)
  }
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await fetch(`${API_URL}/api/bins${query}`)
  return handleResponse<BinRecord[]>(response)
}

export async function createBin(payload: BinCreateRequest): Promise<BinRecord> {
  const response = await fetch(`${API_URL}/api/bins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<BinRecord>(response)
}

export async function closeBin(binId: string, notes?: string): Promise<BinRecord> {
  const response = await fetch(`${API_URL}/api/bins/${encodeURIComponent(binId)}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  return handleResponse<BinRecord>(response)
}

export async function sortGarment(payload: GarmentSortRequest): Promise<SortGarmentResponse> {
  const response = await fetch(`${API_URL}/api/garments/sort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<SortGarmentResponse>(response)
}

export async function getRecentGarments(limit = 15): Promise<GarmentItem[]> {
  const response = await fetch(`${API_URL}/api/garments/recent?limit=${limit}`)
  return handleResponse<GarmentItem[]>(response)
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

function authHeaders(token: string, json = false): HeadersInit {
  return json
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${token}` }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return handleResponse<LoginResponse>(response)
}

export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders(token) })
  return handleResponse<User>(response)
}

export async function listUsers(token: string, offset = 0, limit = 100): Promise<User[]> {
  const response = await fetch(`${API_URL}/api/users?offset=${offset}&limit=${limit}`, {
    headers: authHeaders(token),
  })
  return handleResponse<User[]>(response)
}

export async function createUser(
  token: string,
  payload: UserCreateRequest,
): Promise<UserWithTemporaryPassword> {
  const response = await fetch(`${API_URL}/api/users`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  })
  return handleResponse<UserWithTemporaryPassword>(response)
}

export async function resetUserPassword(
  token: string,
  userId: number,
): Promise<UserWithTemporaryPassword> {
  const response = await fetch(`${API_URL}/api/users/${userId}/reset-password`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse<UserWithTemporaryPassword>(response)
}

export async function listSites(token: string): Promise<Store[]> {
  const response = await fetch(`${API_URL}/api/sites`, { headers: authHeaders(token) })
  return handleResponse<Store[]>(response)
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  })
  return handleResponse<User>(response)
}

export async function updateUser(
  token: string,
  userId: number,
  payload: UserUpdateRequest,
): Promise<User> {
  const response = await fetch(`${API_URL}/api/users/${userId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  })
  return handleResponse<User>(response)
}

export async function deleteUser(token: string, userId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`API request failed (${response.status}): ${errorBody || response.statusText}`)
  }
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
