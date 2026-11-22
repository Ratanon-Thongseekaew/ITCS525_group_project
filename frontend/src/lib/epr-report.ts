import type { EprQuarterReport } from '@/api'

const weights = [
  ['Total weight received', 'total_weight_received_kg'],
  ['Resold', 'resold_weight_kg'],
  ['Repaired', 'repaired_weight_kg'],
  ['Upcycled', 'upcycled_weight_kg'],
  ['Fibre-to-fibre', 'fibre_to_fibre_weight_kg'],
  ['Downcycled', 'downcycled_weight_kg'],
  ['Exported', 'exported_weight_kg'],
  ['Incinerated with energy recovery', 'incinerated_energy_recovery_weight_kg'],
  ['Landfilled', 'landfilled_weight_kg'],
  ['Uncategorized', 'uncategorized_weight_kg'],
] as const

export function getEprReportRows(report: EprQuarterReport) {
  const rows: [string, number, string][] = weights.map(([label, field]) => [
    label,
    report[field],
    'kg',
  ])
  if (report.excess_weight_kg > 0) {
    rows.push(['Categorized weight above received weight', report.excess_weight_kg, 'kg'])
  }
  if (report.garments_missing_weight !== null && report.garments_missing_weight > 0) {
    rows.push(['Garments with missing weight', report.garments_missing_weight, 'items'])
  }
  rows.push(['Recovery rate', report.recovery_rate_percent, '%'])
  return rows
}

export function getEprSourceNote(report: EprQuarterReport) {
  return report.source === 'submitted_snapshot'
    ? 'Totals saved when this quarter was submitted.'
    : 'Live totals. Resold weight uses resale bins with a recorded sale value. Repaired weight uses the repair/upcycle classification.'
}

export function downloadEprCsv(report: EprQuarterReport) {
  const rows = [
    ['Year', 'Quarter', 'Scope', 'Data source', 'Metric', 'Value', 'Unit'],
    ...getEprReportRows(report).map(([metric, value, unit]) => [
      report.year,
      report.quarter,
      'All sites',
      getEprSourceNote(report),
      metric,
      value,
      unit,
    ]),
  ]
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\r\n')
  const url = URL.createObjectURL(new Blob([csv, '\r\n'], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `epr-${report.year}-q${report.quarter}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(URL.revokeObjectURL.bind(URL, url), 1000)
}
