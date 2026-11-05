export interface Greeting {
  message: string
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
