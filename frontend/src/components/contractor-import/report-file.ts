import type { ReportRow } from './types'

/** Columns of a contractor monthly outcome report, in template order. */
export const REPORT_COLUMNS = [
  'bin_id',
  'received_kg',
  'upcycled_kg',
  'fibre_to_fibre_kg',
  'downcycled_kg',
  'exported_kg',
  'landfilled_kg',
  'incinerated_energy_recovery_kg',
] as const

/** Upload limits, matching the API. */
export const MAX_FILE_MB = 5
export const MAX_DATA_ROWS = 2000

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The rejected rows as a CSV the contractor can fix and send back, with each row's reasons. */
export function rejectedRowsCsv(rows: readonly ReportRow[]) {
  const lines = rows
    .filter((row) => row.status === 'Error')
    .map((row) =>
      [
        row.row,
        row.binId,
        row.reportedWeight,
        row.upcycledKg,
        row.fibreToFibreKg,
        row.downcycledKg,
        row.exportedKg,
        row.landfilledKg,
        row.energyRecoveryKg,
        row.errors.join(' '),
      ]
        .map(csvCell)
        .join(','),
    )
  return [['row', ...REPORT_COLUMNS, 'reason'].join(','), ...lines].join('\n')
}

/** Saves text as a CSV file in the browser. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
