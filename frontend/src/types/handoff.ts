// The handoff contract lives in @/api, next to its request functions. This module adds UI labels.
import type { HandoffOutcomes, HandoffRecordStatus } from '@/api'

export type {
  HandoffActorOption,
  HandoffContractorOption,
  HandoffOptions,
  HandoffOutcomes,
  HandoffReadyBin,
  HandoffRecord,
  HandoffRecordStatus,
  HandoffSiteOption,
} from '@/api'

export const handoffRecordStatusLabels: Record<HandoffRecordStatus, string> = {
  scheduled: 'Scheduled',
  picked_up: 'Picked Up',
  disputed: 'Disputed',
  approved: 'Approved',
  closed: 'Closed',
}

// Handoffs are created at pickup, so 'scheduled' only appears on older records and isn't a filter.
export type HandoffRecordFilter = 'all' | Exclude<HandoffRecordStatus, 'scheduled'>

export const handoffRecordFilterLabels: Record<HandoffRecordFilter, string> = {
  all: 'All',
  picked_up: handoffRecordStatusLabels.picked_up,
  disputed: handoffRecordStatusLabels.disputed,
  approved: handoffRecordStatusLabels.approved,
  closed: handoffRecordStatusLabels.closed,
}

export type HandoffRecordSort = 'date' | 'bin_id' | 'recorded_weight'

export const handoffRecordSortLabels: Record<HandoffRecordSort, string> = {
  date: 'Date',
  bin_id: 'Bin ID',
  recorded_weight: 'Recorded Weight',
}

export const handoffOutcomeLabels: Record<keyof HandoffOutcomes, string> = {
  upcycled_weight_kg: 'Upcycled',
  fibre_to_fibre_weight_kg: 'Fibre to Fibre',
  downcycled_weight_kg: 'Downcycled',
  exported_weight_kg: 'Exported',
  landfilled_weight_kg: 'Landfilled',
  incinerated_energy_recovery_weight_kg: 'Incinerated (Energy Recovery)',
}

// Pickup weights that differ by more than this are Disputed and need manager approval.
export const DISPUTE_THRESHOLD_PERCENT = 3

export const MAX_SCALE_PHOTO_BYTES = 5 * 1024 * 1024
export const SCALE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
