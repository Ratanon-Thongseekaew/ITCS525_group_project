import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Link } from 'react-router'

import { getEprQuarterReport, type EprQuarterReport } from '@/api'
import { EprReportPeriodFields } from '@/components/EprReportPeriodFields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { downloadEprCsv } from '@/lib/epr-report'

interface EprReportExportDialogProps {
  defaultYear: number
  defaultQuarter: number
  years: number[]
}

const outlineButtonClass =
  'cursor-pointer border-slate-300 bg-white text-slate-700! hover:border-slate-400 hover:bg-slate-100 focus-visible:ring-teal-600'
const primaryButtonClass =
  'cursor-pointer bg-teal-700 text-white! hover:bg-teal-800 focus-visible:ring-teal-600'

function ExportActions({ year, quarter }: { year: number; quarter: number }) {
  const [report, setReport] = useState<EprQuarterReport>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getEprQuarterReport(year, quarter, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setReport(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [year, quarter, attempt])

  if (failed) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-rose-700">
          The EPR report could not be loaded.
        </p>
        <Button
          variant="outline"
          className={outlineButtonClass}
          onClick={() => {
            setFailed(false)
            setAttempt((count) => count + 1)
          }}
        >
          Retry
        </Button>
      </div>
    )
  }

  return (
    <>
      {!report && (
        <p role="status" className="text-sm text-slate-600">
          Loading EPR report…
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className={outlineButtonClass}
          disabled={!report}
          onClick={() => report && downloadEprCsv(report)}
        >
          <Download aria-hidden="true" />
          Download CSV
        </Button>
        {report ? (
          <Button asChild className={primaryButtonClass}>
            <Link
              to={`../epr-report/print?year=${year}&quarter=${quarter}`}
              relative="path"
              state={{ report }}
            >
              <Printer aria-hidden="true" />
              Open printable report
            </Link>
          </Button>
        ) : (
          <Button disabled className={primaryButtonClass}>
            <Printer aria-hidden="true" />
            Open printable report
          </Button>
        )}
      </div>
    </>
  )
}

export function EprReportExportDialog({
  defaultYear,
  defaultQuarter,
  years,
}: EprReportExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(defaultYear)
  const [quarter, setQuarter] = useState(defaultQuarter)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setYear(defaultYear)
          setQuarter(defaultQuarter)
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className={primaryButtonClass}>
          <Download aria-hidden="true" />
          Export EPR Report
        </Button>
      </DialogTrigger>
      <DialogContent
        overlayClassName="bg-black/20"
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] sm:max-w-md gap-0 overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 text-slate-900 sm:rounded-2xl [&>button]:text-slate-600 [&>button]:focus-visible:ring-teal-600"
      >
        <DialogHeader className="px-5 pt-5 pr-12 text-left sm:px-6 sm:pr-12">
          <DialogTitle>Export quarterly EPR report</DialogTitle>
          <DialogDescription className="text-slate-600">
            Choose the reporting period. The report covers all sites.
          </DialogDescription>
        </DialogHeader>
        <div className="p-5 sm:p-6">
          <EprReportPeriodFields
            year={year}
            quarter={quarter}
            years={years}
            onYearChange={setYear}
            onQuarterChange={setQuarter}
          />
        </div>
        <div className="space-y-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          {open && <ExportActions key={`${year}-${quarter}`} year={year} quarter={quarter} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
