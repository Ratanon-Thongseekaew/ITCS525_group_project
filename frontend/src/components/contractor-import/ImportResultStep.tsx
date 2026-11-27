import { CheckCircle2, RefreshCw } from 'lucide-react'

import type { ContractorReportImportResponse } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface ImportResultStepProps {
  result: ContractorReportImportResponse | null
  onViewDashboard: () => void
  onImportAnother: () => void
}

/** Step 3: the report was saved. */
export function ImportResultStep({
  result,
  onViewDashboard,
  onImportAnother,
}: ImportResultStepProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-4 text-center md:p-8">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="size-6" aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-foreground">Report Saved</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {result?.message ?? 'The saved outcomes now appear on the compliance dashboard.'}
        </p>
      </div>
      {result ? (
        <Alert variant="success" role="status" className="text-left">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription className="text-xs font-semibold">
            <ul className="flex flex-col gap-0.5">
              {result.reports.map((report) => (
                <li key={report.report_id}>
                  {report.site_name} • Report #{report.report_id} • {report.imported_rows} row(s)
                </li>
              ))}
            </ul>
            <p>{result.total_categorized_weight_kg.toFixed(2)} kg recorded</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button type="button" onClick={onViewDashboard}>
          View Compliance Dashboard
        </Button>
        <Button type="button" variant="outline" onClick={onImportAnother}>
          <RefreshCw aria-hidden="true" />
          Import Another Report
        </Button>
      </div>
    </div>
  )
}
