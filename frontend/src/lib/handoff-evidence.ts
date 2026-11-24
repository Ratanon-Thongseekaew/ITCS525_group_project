import { MAX_SCALE_PHOTO_BYTES, SCALE_PHOTO_TYPES } from '@/types/handoff'

export interface PickupEvidence {
  staffWeight: string
  driverWeight: string
  driverName: string
  plateNumber: string
  photo: File | null
}

export type PickupEvidenceErrors = Partial<Record<keyof PickupEvidence, string>>

export function emptyPickupEvidence(staffWeightKg?: number): PickupEvidence {
  return {
    staffWeight: staffWeightKg === undefined ? '' : String(staffWeightKg),
    driverWeight: '',
    driverName: '',
    plateNumber: '',
    photo: null,
  }
}

export function parseWeight(value: string) {
  if (value.trim() === '') return null
  const weight = Number(value)
  return Number.isFinite(weight) && weight >= 0 ? weight : null
}

function weightError(value: string, who: string) {
  if (value.trim() === '') return `Enter the ${who} weight.`
  return parseWeight(value) === null ? 'Enter a weight of 0 kg or more.' : undefined
}

export function validatePickupEvidence(evidence: PickupEvidence): PickupEvidenceErrors {
  const errors: PickupEvidenceErrors = {
    staffWeight: weightError(evidence.staffWeight, 'staff'),
    driverWeight: weightError(evidence.driverWeight, "driver's"),
    driverName: evidence.driverName.trim() ? undefined : "Enter the driver's name.",
    plateNumber: evidence.plateNumber.trim() ? undefined : 'Enter the vehicle plate number.',
  }
  if (!evidence.photo) {
    errors.photo = 'Attach a photo of the scale reading.'
  } else if (!SCALE_PHOTO_TYPES.includes(evidence.photo.type)) {
    errors.photo = 'Use a JPEG, PNG, or WebP photo.'
  } else if (evidence.photo.size > MAX_SCALE_PHOTO_BYTES) {
    errors.photo = 'Use a photo of 5 MB or smaller.'
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

export function toPickupPayload(evidence: PickupEvidence) {
  return {
    staff_weight_kg: Number(evidence.staffWeight),
    driver_weight_kg: Number(evidence.driverWeight),
    driver_name: evidence.driverName.trim(),
    vehicle_plate_number: evidence.plateNumber.trim(),
    scale_photo: evidence.photo as File,
  }
}
