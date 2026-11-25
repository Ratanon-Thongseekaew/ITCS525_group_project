import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

import { StatCard } from '@/components/StatCard'
import { TableCard } from '@/components/TableCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OUTCOME_TONES, type OutcomeCategory } from '@/lib/outcome-tones'
import { cn } from '@/lib/utils'
import type { ReportRow } from './types'

const OUTCOME_COLUMNS: { category: OutcomeCategory; value: (row: ReportRow) => number }[] = [
  { category: 'upcycled', value: (row) => row.upcycledKg },
  { category: 'fibre_to_fibre', value: (row) => row.fibreToFibreKg },
  { category: 'downcycled', value: (row) => row.downcycledKg },
  { category: 'exported', value: (row) => row.exportedKg },
  { category: 'landfilled', value: (row) => row.landfilledKg },
  { category: 'incinerated_energy_recovery', value: (row) => row.energyRecoveryKg },
]

function ValidationStatus({ row }: { row: ReportRow }) {
  if (row.status === 'Verified') {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden="true" />
        Verified
      </Badge>
    )
  }

  const isError = row.status === 'Error'
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={isError ? 'destructive' : 'warning'}>
        {isError ? <AlertCircle aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        {isError ? 'Rejected' : 'Flagged'}
      </Badge>
      <p
        className={cn(
          'text-[11px] font-medium whitespace-normal',
          isError ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {row.errorDetail}
      </p>
    </div>
  )
}

interface ImportReviewStepProps {
  rows: readonly ReportRow[]
  siteLabel: string
  reportMonth: string
  fileName: string | null
  contractor: string
  savableCount: number
  isSaving: boolean
  error: string | null
  onBack: () => void
  onSave: () => void
}

/** Step 2: review each row's weights and validation result before saving. */
export function ImportReviewStep({
  rows,
  siteLabel,
  reportMonth,
  fileName,
  contractor,
  savableCount,
  isSaving,
  error,
  onBack,
  onSave,
}: ImportReviewStepProps) {
  const verifiedCount = rows.filter((row) => row.status === 'Verified').length
  const warningCount = rows.filter((row) => row.status === 'Warning').length
  const errorCount = rows.filter((row) => row.status === 'Error').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-2 border-b pb-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Review Report Validation</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Site: <span className="font-semibold text-foreground">{siteLabel}</span> | Month:{' '}
            <span className="font-semibold text-foreground">{reportMonth}</span> | File:{' '}
            <span className="font-semibold text-foreground">{fileName}</span> ({contractor})
          </p>
        </div>
        <Badge variant="success" className="self-start sm:self-auto">
          Ready for Review
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Rows" value={rows.length} />
        <StatCard label="Verified Records" value={verifiedCount} tone="success" />
        <StatCard label="Flagged Warnings" value={warningCount} tone="warning" />
        <StatCard label="Rejected Errors" value={errorCount} tone="destructive" />
      </dl>

      <TableCard title="Validation results">
        <Table className="text-xs">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-3">Row</TableHead>
              <TableHead className="px-3">Bin ID</TableHead>
              <TableHead className="px-3">Contractor</TableHead>
              <TableHead className="px-3">Store Wt</TableHead>
              <TableHead className="px-3">Reported Wt</TableHead>
              {OUTCOME_COLUMNS.map(({ category }) => (
                <TableHead key={category} className={cn('px-3', OUTCOME_TONES[category].tint)}>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn('size-2 shrink-0 rounded-full', OUTCOME_TONES[category].dot)}
                      aria-hidden="true"
                    />
                    {OUTCOME_TONES[category].label}
                  </span>
                </TableHead>
              ))}
              <TableHead className="bg-muted px-3">Uncategorized</TableHead>
              <TableHead className="px-3">Validation Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.row}
                className={cn(
                  row.status === 'Error' && 'bg-destructive/5 hover:bg-destructive/10',
                  row.status === 'Warning' && 'bg-amber-50/50 dark:bg-amber-950/20',
                )}
              >
                <TableCell className="px-3 font-semibold text-muted-foreground">
                  {row.row}
                </TableCell>
                <TableCell
                  className={cn(
                    'px-3 font-mono font-semibold',
                    row.binId === 'MISSING_ID' && 'text-destructive underline',
                  )}
                >
                  {row.binId}
                </TableCell>
                <TableCell className="px-3 font-medium">{row.contractor}</TableCell>
                <TableCell className="px-3 text-muted-foreground">{row.storeWeight} kg</TableCell>
                <TableCell className="px-3 font-semibold">{row.reportedWeight} kg</TableCell>
                {OUTCOME_COLUMNS.map(({ category, value }) => (
                  <TableCell
                    key={category}
                    className={cn('px-3 font-semibold', OUTCOME_TONES[category].tint)}
                  >
                    {value(row)} kg
                  </TableCell>
                ))}
                <TableCell className="bg-muted/60 px-3 font-semibold">
                  {row.uncategorizedKg.toFixed(1)} kg
                </TableCell>
                <TableCell className="px-3">
                  <ValidationStatus row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col items-center justify-between gap-3 pt-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="self-start sm:self-auto"
          onClick={onBack}
        >
          Back to Upload
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={isSaving || savableCount === 0}
          onClick={onSave}
        >
          {isSaving ? 'Saving to Database...' : `Save Valid Records (${savableCount})`}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
