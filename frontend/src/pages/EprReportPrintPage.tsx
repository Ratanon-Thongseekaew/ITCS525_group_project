import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router'

import { getEprQuarterReport, type EprQuarterReport } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print report
        </Button>
      </div>
      <h1 className="text-2xl font-semibold">Quarterly EPR report</h1>
      <p className="mt-2 font-medium">
        Q{quarter} {year} · All sites
      </p>
      <p className="mt-2 text-sm">{getEprSourceNote(report)}</p>
      <Table className="mt-5">
        <TableHeader>
          <TableRow className="border-foreground/40 hover:bg-transparent print:border-black/40">
            <TableHead scope="col" className="px-0">
              Metric
            </TableHead>
            <TableHead scope="col" className="pr-0 pl-2 text-right">
              Value
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {getEprReportRows(report).map(([label, value, unit]) => (
            <TableRow
              key={label}
              className="break-inside-avoid hover:bg-transparent print:border-black/15"
            >
              <TableHead scope="row" className="px-0 text-foreground print:text-black">
                {label}
              </TableHead>
              <TableCell className="pr-0 pl-2 text-right tabular-nums">
                {numberFormatter.format(value)}
                {unit === '%' ? '%' : ` ${unit}`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
    <main className="mx-auto max-w-2xl bg-background p-5 text-foreground sm:p-8 print:max-w-none print:bg-white print:p-0 print:text-black">
      <Link
        to="../../compliance-dashboard"
        relative="path"
        className="mb-5 inline-block rounded-sm text-sm font-medium text-primary underline underline-offset-4 transition-colors outline-none hover:decoration-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 print:hidden"
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
