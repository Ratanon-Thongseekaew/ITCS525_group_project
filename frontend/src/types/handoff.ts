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
