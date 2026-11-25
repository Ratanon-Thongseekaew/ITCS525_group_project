import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ClipboardList } from 'lucide-react'

import {
  getEprManagement,
  saveEprAdjustment,
  submitEprQuarter,
  type EprAdjustmentMetric,
  type EprManagement,
  type EprQuarterReport,
} from '@/api'
import { EprReportPeriodFields } from '@/components/EprReportPeriodFields'
import { ErrorState } from '@/components/LoadState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getEprReportRows } from '@/lib/epr-report'

const metricLabels: Record<EprAdjustmentMetric, string> = {
  total_received: 'Total weight received',
  resold: 'Resold',
  repaired: 'Repaired',
  upcycled: 'Upcycled',
  fibre_to_fibre: 'Fibre-to-fibre',
  downcycled: 'Downcycled',
  exported: 'Exported',
  landfilled: 'Landfilled',
  incinerated_energy_recovery: 'Incinerated with energy recovery',
}
const metricOptions = Object.entries(metricLabels).map(([value, label]) => ({ value, label }))
const numberFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 4 })
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

function ReportTotals({ report, title }: { report: EprQuarterReport; title: string }) {
  return (
    <section className="min-w-0 rounded-lg border bg-muted/50 p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="space-y-1.5 text-sm">
        {getEprReportRows(report).map(([label, value, unit]) => (
          <div className="flex justify-between gap-3" key={label}>
            <dt>{label}</dt>
            <dd className="shrink-0 font-medium tabular-nums">
              {numberFormat.format(value)}
              {unit === '%' ? '%' : ` ${unit}`}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  disabled: boolean
}) {
  const id = useId()
  return (
    <Field className="min-w-0 gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="min-w-0 [&>span]:truncate">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function AdjustmentForm({
  sites,
  pending,
  onCancel,
  onSave,
}: {
  sites: EprManagement['sites']
  pending: boolean
  onCancel: () => void
  onSave: (siteId: number, date: string, reason: string, lines: AdjustmentLine[]) => void
}) {
  const id = useId()
  const nextId = useRef(1)
  const [site, setSite] = useState('')
  const [lines, setLines] = useState<AdjustmentLine[]>([{ id: 0, metric: '', amount: '' }])
  const linesValid =
    lines.every((line) => line.metric && Number(line.amount) !== 0) &&
    new Set(lines.map((line) => line.metric)).size === lines.length

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    if (site && linesValid && !pending) {
      onSave(Number(site), String(fields.get('effectiveDate')), String(fields.get('reason')), lines)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Add adjustment</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceField
          label="Site"
          value={site}
          onChange={setSite}
          disabled={pending}
          options={sites.map(({ id, label }) => ({ value: String(id), label }))}
        />
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${id}-date`}>Effective date</FieldLabel>
          <Input id={`${id}-date`} name="effectiveDate" type="date" required disabled={pending} />
        </Field>
      </div>
      {lines.map((line, index) => (
        <div
          className="grid gap-2 rounded-md bg-muted/50 p-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
          key={line.id}
        >
          <ChoiceField
            label={`Metric ${index + 1}`}
            value={line.metric}
            disabled={pending}
            options={metricOptions.filter(
              ({ value }) =>
                value === line.metric || !lines.some((other) => other.metric === value),
            )}
            onChange={(metric) =>
              setLines((previous) =>
                previous.map((item) =>
                  item.id === line.id ? { ...item, metric: metric as EprAdjustmentMetric } : item,
                ),
              )
            }
          />
          <Field className="gap-1.5">
            <FieldLabel htmlFor={`${id}-kg-${line.id}`}>Change (kg)</FieldLabel>
            <Input
              id={`${id}-kg-${line.id}`}
              type="number"
              step="0.001"
              required
              disabled={pending}
              value={line.amount}
              onChange={(event) => {
                const amount = event.target.value
                setLines((previous) =>
                  previous.map((item) => (item.id === line.id ? { ...item, amount } : item)),
                )
              }}
            />
          </Field>
          {lines.length > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setLines((previous) => previous.filter((item) => item.id !== line.id))}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Use a negative number to subtract weight and a positive number to add weight.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={pending || lines.length >= metricOptions.length}
        onClick={() => {
          const lineId = nextId.current++
          setLines((previous) => [...previous, { id: lineId, metric: '', amount: '' }])
        }}
      >
        Add line
      </Button>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${id}-reason`}>Reason</FieldLabel>
        <Textarea id={`${id}-reason`} name="reason" required maxLength={500} disabled={pending} />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !site || !linesValid}>
          {pending ? 'Saving…' : 'Save adjustment'}
        </Button>
      </div>
    </form>
  )
}

type AdjustmentLine = { id: number; metric: EprAdjustmentMetric | ''; amount: string }

function ManagementPanel({
  year,
  quarter,
  pending,
  setPending,
}: {
  year: number
  quarter: number
  pending: boolean
  setPending: (pending: boolean) => void
}) {
  const [data, setData] = useState<EprManagement>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [actor, setActor] = useState('')
  const [action, setAction] = useState<'confirm-submit' | 'adjustment' | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void getEprManagement(year, quarter, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('The EPR report could not be loaded.')
      })
    return () => controller.abort()
  }, [year, quarter, attempt])

  async function save(write: () => Promise<EprManagement>) {
    setPending(true)
    setError('')
    try {
      setData(await write())
      setAction(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'The report could not be saved.',
      )
    } finally {
      setPending(false)
    }
  }

  if (!data) {
    return error ? (
      <ErrorState
        message={error}
        onRetry={() => {
          setError('')
          setAttempt((count) => count + 1)
        }}
      />
    ) : (
      <p role="status" className="text-sm text-muted-foreground">
        Loading EPR report.
      </p>
    )
  }

  const submitted = data.status === 'submitted'
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm font-semibold text-primary">
        {submitted ? 'Submitted and locked' : 'Draft'}
        {data.submitted_at && ` · ${dateFormat.format(new Date(data.submitted_at))}`}
        {data.submitted_by && ` · ${data.submitted_by}`}
      </p>
      <div className={data.adjusted_report ? 'grid gap-3 sm:grid-cols-2' : ''}>
        <ReportTotals
          report={data.report}
          title={submitted ? 'Original submitted totals' : 'Draft totals'}
        />
        {data.adjusted_report && (
          <ReportTotals report={data.adjusted_report} title="Totals after adjustments" />
        )}
      </div>
      {submitted && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Adjustment history</h3>
          {data.adjustments.length === 0 && (
            <p className="text-sm text-muted-foreground">No adjustments recorded.</p>
          )}
          {data.adjustments.map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3 text-sm break-words">
              <p className="font-medium">
                {metricLabels[entry.metric]} · {entry.weight_delta_kg > 0 && '+'}
                {numberFormat.format(entry.weight_delta_kg)} kg
              </p>
              <p className="text-muted-foreground">
                Effective {entry.effective_date} ·{' '}
                {data.sites.find((site) => site.id === entry.site_id)?.label}
              </p>
              <p>{entry.reason}</p>
              <p className="text-xs text-muted-foreground">
                Recorded {dateFormat.format(new Date(entry.created_at))} by {entry.recorded_by}
              </p>
            </div>
          ))}
        </section>
      )}
      <ChoiceField
        label="Recorded by"
        value={actor}
        onChange={setActor}
        disabled={pending}
        options={data.actors.map(({ id, label }) => ({ value: String(id), label }))}
      />
      <FieldDescription className="-mt-2 text-xs">
        {data.actors.length
          ? 'Select the account to record in this demo.'
          : 'Create a manager or admin account to record changes.'}
      </FieldDescription>
      {error && <ErrorState message={error} />}
      {action === 'confirm-submit' && (
        <Alert variant="warning" role="group" aria-label="Confirm submit">
          <AlertDescription className="flex w-full flex-col gap-3">
            <p className="text-sm text-foreground">
              Submit Q{quarter} {year} for all sites? The original totals will be locked. Future
              corrections require an adjustment.
            </p>
            <div className="flex flex-wrap justify-end gap-2 self-stretch">
              <Button variant="outline" disabled={pending} onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button
                disabled={pending || !actor}
                onClick={() => void save(() => submitEprQuarter(year, quarter, Number(actor)))}
              >
                {pending ? 'Submitting…' : 'Confirm submit and lock'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {action === 'adjustment' && (
        <AdjustmentForm
          sites={data.sites}
          pending={pending || !actor}
          onCancel={() => setAction(null)}
          onSave={(siteId, effectiveDate, reason, lines) =>
            void save(() =>
              saveEprAdjustment(year, quarter, {
                actor_id: Number(actor),
                site_id: siteId,
                expected_latest_adjustment_id: data.adjustments.at(-1)?.id ?? null,
                effective_date: effectiveDate,
                reason,
                lines: lines.flatMap(({ metric, amount }) =>
                  metric ? [{ metric, weight_delta_kg: amount }] : [],
                ),
              }),
            )
          }
        />
      )}
      {action === null && (
        <div className="flex justify-end">
          <Button
            disabled={!actor || (submitted && !data.sites.length)}
            onClick={() => {
              setError('')
              setAction(submitted ? 'adjustment' : 'confirm-submit')
            }}
          >
            {submitted ? 'Add Adjustment' : 'Submit & Lock'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function EprReportManagementDialog({
  defaultYear,
  defaultQuarter,
  years,
}: {
  defaultYear: number
  defaultQuarter: number
  years: number[]
}) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(defaultYear)
  const [quarter, setQuarter] = useState(defaultQuarter)
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        if (nextOpen) {
          setYear(defaultYear)
          setQuarter(defaultQuarter)
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList aria-hidden="true" />
          Manage EPR Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Manage EPR Report</DialogTitle>
          <DialogDescription>
            Review, submit, and adjust quarterly reports for all sites.
          </DialogDescription>
        </DialogHeader>
        <EprReportPeriodFields
          year={year}
          quarter={quarter}
          years={years}
          disabled={pending}
          onYearChange={setYear}
          onQuarterChange={setQuarter}
        />
        {open && (
          <ManagementPanel
            key={`${year}-${quarter}`}
            year={year}
            quarter={quarter}
            pending={pending}
            setPending={setPending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
