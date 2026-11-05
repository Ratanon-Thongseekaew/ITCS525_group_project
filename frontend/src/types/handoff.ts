export type HandoffBinStatus = 'awaiting_handoff'

export const handoffStatusLabels: Record<HandoffBinStatus, string> = {
  awaiting_handoff: 'Awaiting Handoff',
}

export interface HandoffBin {
  id: string
  bin_code: string
  bin_type: 'recycle'
  status: HandoffBinStatus
  item_count: number
  total_weight_kg: number
  // ISO datetime without a UTC offset, so it displays as the recorded local time.
  packed_at: string
}

export interface HandoffContractor {
  id: string
  name: string
}

export interface NewHandoffRecord {
  bin_id: string
  contractor_id: string
  // ISO datetime without a UTC offset, like HandoffBin.packed_at.
  pickup_at: string
  notes: string | null
}

export type HandoffRecordStatus = 'collected' | 'outcomes_received'

export const handoffRecordStatusLabels: Record<HandoffRecordStatus, string> = {
  collected: 'Collected',
  outcomes_received: 'Outcomes Received',
}

export interface MaterialOutcomes {
  upcycled_kg: number
  recycled_to_fiber_kg: number
  downcycled_kg: number
  exported_overseas_kg: number
  landfill_kg: number
}

interface HandoffRecordBase {
  id: string
  bin_code: string
  contractor: HandoffContractor
  // ISO datetime without a UTC offset, like HandoffBin.packed_at.
  collected_at: string
  item_count: number
  recorded_weight_kg: number
}

// A record has outcomes exactly when its status says they were received.
export type HandoffRecord =
  | (HandoffRecordBase & { status: 'collected'; outcomes: null })
  | (HandoffRecordBase & { status: 'outcomes_received'; outcomes: MaterialOutcomes })

export type HandoffRecordFilter = 'all' | HandoffRecordStatus

export const handoffRecordFilterLabels: Record<HandoffRecordFilter, string> = {
  all: 'All',
  ...handoffRecordStatusLabels,
}

export type HandoffRecordSort = 'date' | 'bin_id' | 'recorded_weight'

export const handoffRecordSortLabels: Record<HandoffRecordSort, string> = {
  date: 'Date',
  bin_id: 'Bin ID',
  recorded_weight: 'Recorded Weight',
}
