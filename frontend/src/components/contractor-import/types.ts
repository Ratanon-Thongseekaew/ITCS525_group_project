export interface ReportRow {
  /** The spreadsheet line number; the header is line 1. */
  row: number
  binId: string
  /** The bin's sorting center, or null when the bin wasn't found. */
  siteName: string | null
  /** Weighed by store staff at pickup, or null when unknown. */
  staffWeight: number | null
  reportedWeight: number
  upcycledKg: number
  fibreToFibreKg: number
  downcycledKg: number
  exportedKg: number
  landfilledKg: number
  energyRecoveryKg: number
  uncategorizedKg: number
  status: 'Verified' | 'Warning' | 'Error'
  /** Why the row is rejected. */
  errors: string[]
  /** What to check before saving. */
  warnings: string[]
}

export interface ImportOption {
  value: string
  label: string
}
