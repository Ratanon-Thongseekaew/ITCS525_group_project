import type { BinRecord, BinType, GarmentCondition } from '@/api'

export const CONDITION_LABELS: Record<GarmentCondition, string> = {
  good_reusable: 'Good / Reusable',
  worn_recyclable: 'Worn / Recyclable',
  repair_upcycle: 'Repair / Upcycle',
}

export const BIN_TYPE_LABELS: Record<BinType, string> = {
  resale: 'Direct Resale',
  recycle: 'Recycling',
  repair: 'Repair',
}

export const BIN_STATUS_LABELS: Record<BinRecord['status'], string> = {
  active: 'Active / Open',
  ready: 'Sealed / Ready for handoff',
  handed_off: 'Handed off',
  closed: 'Closed / Sealed',
}
