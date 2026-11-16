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

export type BinType = 'resale' | 'recycle'
export type BinStatus = 'active' | 'closed'
export type GarmentCondition = 'good_reusable' | 'worn_recyclable'

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
}

export interface SortingStatsResponse {
  total_sorted_today: number
  resale_count: number
  recycle_count: number
  resale_percentage: number
  active_resale_bin_code: string | null
  active_resale_bin_items: number
  active_recycle_bin_code: string | null
  active_recycle_bin_items: number
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
