export interface ReportRow {
  row: number
  binId: string
  contractor: string
  storeWeight: number
  reportedWeight: number
  upcycledKg: number
  fibreToFibreKg: number
  downcycledKg: number
  exportedKg: number
  landfilledKg: number
  energyRecoveryKg: number
  uncategorizedKg: number
  status: 'Verified' | 'Warning' | 'Error'
  errorDetail?: string
}

export interface ImportOption {
  value: string
  label: string
}
