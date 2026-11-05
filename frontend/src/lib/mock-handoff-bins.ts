import type { HandoffBin } from '@/types/handoff'

// Temporary mock data. Replace with a real API call once the backend has a handoff endpoint.
export const newHandoffBins: HandoffBin[] = [
  {
    id: 'b1',
    bin_code: 'bin-id-001',
    bin_type: 'recycle',
    status: 'awaiting_handoff',
    item_count: 100,
    total_weight_kg: 40,
    packed_at: '2026-10-01T15:30:00',
  },
  {
    id: 'b2',
    bin_code: 'bin-id-002',
    bin_type: 'recycle',
    status: 'awaiting_handoff',
    item_count: 100,
    total_weight_kg: 40,
    packed_at: '2026-10-01T15:30:00',
  },
]

export const nextScheduledPickup: string | null = '2026-10-20T18:30:00'
