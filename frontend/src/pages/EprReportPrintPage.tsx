import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { getEprQuarterReport, type EprQuarterReport } from '@/api'
import { Button } from '@/components/ui/button'
import { getEprReportRows, getEprSourceNote } from '@/lib/epr-report'

const numberFormatter = new Intl.NumberFormat('en', { maximumFractionDigits: 4 })

function PrintableReport({
  year,
  quarter,
  initialReport,
}: {
  year: number
  quarter: number
  initialReport?: EprQuarterReport
}) {
  const [report, setReport] = useState(initialReport)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (initialReport) return
    const controller = new AbortController()
    void getEprQuarterReport(year, quarter, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setReport(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [initialReport, quarter, year])

  if (failed) return <p role="alert">The EPR report could not be loaded.</p>
  if (!report) return <p role="status">Loading EPR report…</p>

  return (
    <>
      <div className="mb-5 print:hidden">
        <Button
          className="cursor-pointer bg-teal-700 text-white! hover:bg-teal-800 focus-visible:ring-teal-600"
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          Print report
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Quarterly EPR report</h1>
      <p className="mt-2 font-medium">
        Q{quarter} {year} · All sites
      </p>
      <p className="mt-2 text-sm">{getEprSourceNote(report)}</p>
      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-400">
            <th scope="col" className="py-2 text-left">
              Metric
            </th>
            <th scope="col" className="py-2 pl-2 text-right">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {getEprReportRows(report).map(([label, value, unit]) => (
            <tr key={label} className="break-inside-avoid border-b border-slate-200">
              <th scope="row" className="py-2 text-left font-medium">
                {label}
              </th>
              <td className="whitespace-nowrap py-2 pl-2 text-right tabular-nums">
                {numberFormatter.format(value)}
                {unit === '%' ? '%' : ` ${unit}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export function EprReportPrintPage() {
  const [params] = useSearchParams()
  const { state } = useLocation()
  const year = Number(params.get('year'))
  const quarter = Number(params.get('quarter'))
  const fromDialog = (state as { report?: EprQuarterReport } | null)?.report
  const initialReport =
    fromDialog?.year === year && fromDialog.quarter === quarter ? fromDialog : undefined
  const validPeriod =
    Number.isInteger(year) &&
    year >= 1900 &&
    year <= 9998 &&
    Number.isInteger(quarter) &&
    quarter >= 1 &&
    quarter <= 4

  return (
    <main className="mx-auto max-w-2xl p-5 text-slate-950 sm:p-8 print:max-w-none print:p-0 print:text-black">
      <Link
        to="../../compliance-dashboard"
        relative="path"
        className="mb-5 inline-block cursor-pointer rounded-sm text-sm font-medium text-teal-700 underline underline-offset-4 transition-colors hover:text-teal-900 hover:decoration-2 focus-visible:ring-2 focus-visible:ring-teal-600 print:hidden"
      >
        Back to Compliance Dashboard
      </Link>
      {validPeriod ? (
        <PrintableReport
          key={`${year}-${quarter}`}
          year={year}
          quarter={quarter}
          initialReport={initialReport}
        />
      ) : (
        <p role="alert">Choose a valid year and quarter from the Compliance Dashboard.</p>
      )}
    </main>
  )
}
