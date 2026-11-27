import type {
  HandoffOutcomes,
  HandoffRecord,
  HandoffRecordFilter,
  HandoffRecordSort,
  HandoffRecordStatus,
  HandoffReviewFilter,
  HandoffReviewStage,
} from '@/types/handoff'
import type { BadgeVariant } from '@/lib/bin-type-tones'

export const HANDOFF_STATUS_BADGE_VARIANTS: Record<HandoffRecordStatus, BadgeVariant> = {
  scheduled: 'secondary',
  picked_up: 'warning',
  disputed: 'destructive',
  approved: 'success',
  closed: 'success',
}

// Rounded so summed decimal weights can't carry floating-point noise.
function roundWeight(value: number) {
  return Number(value.toFixed(2))
}

export function getOutcomeTotal(outcomes: HandoffOutcomes) {
  return roundWeight(Object.values(outcomes).reduce((sum, weight) => sum + weight, 0))
}

export function getOutcomeVariance(outcomes: HandoffOutcomes, recordedWeightKg: number) {
  return roundWeight(getOutcomeTotal(outcomes) - recordedWeightKg)
}

/**
 * The status to show. A handoff only counts as closed once its contractor outcome report is in;
 * older records saved as closed without one show the step they are really at instead.
 */
export function getDisplayStatus(record: HandoffRecord): HandoffRecordStatus {
  if (record.status !== 'closed' || record.outcomes) return record.status
  return record.approved_by ? 'approved' : 'picked_up'
}

export function getRecordedWeight(record: HandoffRecord) {
  return record.staff_weight_kg ?? record.bin_weight_kg
}

/** The gap between the two pickup weights, in kg. */
export function getWeightDifferenceKg(staffWeightKg: number, driverWeightKg: number) {
  return roundWeight(Math.abs(staffWeightKg - driverWeightKg))
}

/**
 * Percentage of the staff weight: |staff − driver| ÷ staff × 100.
 * Same formula as Handoff.record_pickup_weights in the backend, including its rounding to four
 * decimal places, so 41.2 kg against 40 kg is exactly 3% (not Disputed) here as well.
 */
export function getWeightVariancePercent(staffWeightKg: number, driverWeightKg: number) {
  if (!staffWeightKg) return driverWeightKg ? 100 : 0
  const variance = (Math.abs(staffWeightKg - driverWeightKg) / staffWeightKg) * 100
  return Math.round(variance * 10_000) / 10_000
}

function getRecordTime(record: HandoffRecord) {
  const value = record.picked_up_at ?? record.scheduled_pickup_at
  return value ? new Date(value).getTime() : 0
}

const recordComparators: Record<
  HandoffRecordSort,
  (first: HandoffRecord, second: HandoffRecord) => number
> = {
  date: (first, second) => getRecordTime(second) - getRecordTime(first),
  bin_id: (first, second) =>
    first.bin_code.localeCompare(second.bin_code, undefined, { numeric: true }),
  recorded_weight: (first, second) => getRecordedWeight(second) - getRecordedWeight(first),
}

export function getVisibleRecords(
  records: readonly HandoffRecord[],
  filter: HandoffRecordFilter,
  sort: HandoffRecordSort,
) {
  return records
    .filter((record) => filter === 'all' || getDisplayStatus(record) === filter)
    .sort(recordComparators[sort])
}

/** A manager approves a handoff only while it is Disputed (pickup weights differ by over 3%). */
export function canApprove(record: HandoffRecord) {
  return record.status === 'disputed'
}

/**
 * A manager closes a picked-up or approved handoff once its contractor outcome report is in.
 * Same rules as POST /api/handoffs/{id}/close.
 */
export function canClose(record: HandoffRecord) {
  return (record.status === 'picked_up' || record.status === 'approved') && record.outcomes !== null
}

export function getReviewStage(record: HandoffRecord): HandoffReviewStage {
  if (record.status === 'disputed') return 'needs_approval'
  if (!record.outcomes) return 'awaiting_report'
  return record.status === 'closed' ? 'closed' : 'ready_to_close'
}

export function getVisibleReviewRecords(
  records: readonly HandoffRecord[],
  filter: HandoffReviewFilter,
  sort: HandoffRecordSort,
) {
  return records
    .filter((record) => filter === 'all' || getReviewStage(record) === filter)
    .sort(recordComparators[sort])
}
