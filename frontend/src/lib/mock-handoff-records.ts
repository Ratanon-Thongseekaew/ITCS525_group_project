import type { HandoffRecord } from '@/types/handoff'

// Temporary mock data. Replace with a real API call once the backend has a handoff records endpoint.
export const handoffRecords: HandoffRecord[] = [
  {
    id: 'r1',
    bin_code: 'bin-id-001',
    contractor: { id: 'c2', name: 'Contractor 2' },
    collected_at: '2026-10-20T18:30:00',
    item_count: 100,
    recorded_weight_kg: 40,
    status: 'collected',
    outcomes: null,
  },
  {
    id: 'r2',
    bin_code: 'bin-id-002',
    contractor: { id: 'c1', name: 'Contractor 1' },
    collected_at: '2026-10-16T18:00:00',
    item_count: 100,
    recorded_weight_kg: 40,
    status: 'outcomes_received',
    outcomes: {
      upcycled_kg: 5,
      recycled_to_fiber_kg: 15,
      downcycled_kg: 10,
      exported_overseas_kg: 5,
      landfill_kg: 4,
    },
  },
]
