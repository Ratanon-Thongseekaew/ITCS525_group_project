import type {
  HandoffRecord,
  HandoffRecordFilter,
  HandoffRecordSort,
  MaterialOutcomes,
} from '@/types/handoff'

// Rounded so summed decimal weights can't carry floating-point noise.
function roundWeight(value: number) {
  return Number(value.toFixed(2))
}

export function getOutcomeTotal(outcomes: MaterialOutcomes) {
  return roundWeight(
    outcomes.upcycled_kg +
      outcomes.recycled_to_fiber_kg +
      outcomes.downcycled_kg +
      outcomes.exported_overseas_kg +
      outcomes.landfill_kg,
  )
}

export function getOutcomeVariance(outcomes: MaterialOutcomes, recordedWeightKg: number) {
  return roundWeight(getOutcomeTotal(outcomes) - recordedWeightKg)
}

const recordComparators: Record<
  HandoffRecordSort,
  (first: HandoffRecord, second: HandoffRecord) => number
> = {
  date: (first, second) =>
    new Date(second.collected_at).getTime() - new Date(first.collected_at).getTime(),
  bin_id: (first, second) =>
    first.bin_code.localeCompare(second.bin_code, undefined, { numeric: true }),
  recorded_weight: (first, second) => second.recorded_weight_kg - first.recorded_weight_kg,
}

export function getVisibleRecords(
  records: readonly HandoffRecord[],
  filter: HandoffRecordFilter,
  sort: HandoffRecordSort,
) {
  return records
    .filter((record) => filter === 'all' || record.status === filter)
    .sort(recordComparators[sort])
}
