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
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
const primaryClass =
  'cursor-pointer bg-teal-700 text-white! hover:bg-teal-800 focus-visible:ring-teal-600'
const outlineClass =
  'cursor-pointer border-slate-300 bg-white text-slate-700! hover:bg-slate-100 focus-visible:ring-teal-600'
const fieldClass = 'border-slate-300 bg-white text-slate-900 focus-visible:ring-teal-600'

function ReportTotals({ report, title }: { report: EprQuarterReport; title: string }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
    <div className="min-w-0 space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
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
    </div>
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
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold">Add adjustment</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceField
          label="Site"
          value={site}
          onChange={setSite}
          disabled={pending}
          options={sites.map(({ id, label }) => ({ value: String(id), label }))}
        />
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="text-sm font-medium">
            Effective date
          </label>
          <Input
            id={`${id}-date`}
            name="effectiveDate"
            type="date"
            required
            disabled={pending}
            className={fieldClass}
          />
        </div>
      </div>
      {lines.map((line, index) => (
        <div
          className="grid gap-2 rounded-md bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
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
          <div className="space-y-1">
            <label htmlFor={`${id}-kg-${line.id}`} className="text-sm font-medium">
              Change (kg)
            </label>
            <Input
              id={`${id}-kg-${line.id}`}
              type="number"
              step="0.001"
              required
              disabled={pending}
              value={line.amount}
              className={fieldClass}
              onChange={(event) => {
                const amount = event.target.value
                setLines((previous) =>
                  previous.map((item) => (item.id === line.id ? { ...item, amount } : item)),
                )
              }}
            />
          </div>
          {lines.length > 1 && (
            <Button
              type="button"
              variant="outline"
              className={outlineClass}
              disabled={pending}
              aria-label={`Remove line ${index + 1}`}
              onClick={() => setLines((previous) => previous.filter((item) => item.id !== line.id))}
            >
              Remove
            </Button>
          )}
        </div>
      ))}
      <p className="text-xs text-slate-600">
        Use a negative number to subtract weight and a positive number to add weight.
      </p>
      <Button
        type="button"
        variant="outline"
        className={outlineClass}
        disabled={pending || lines.length >= metricOptions.length}
        onClick={() => {
          const lineId = nextId.current++
          setLines((previous) => [...previous, { id: lineId, metric: '', amount: '' }])
        }}
      >
        Add line
      </Button>
      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className="text-sm font-medium">
          Reason
        </label>
        <Textarea
          id={`${id}-reason`}
          name="reason"
          required
          maxLength={500}
          disabled={pending}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className={outlineClass}
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" className={primaryClass} disabled={pending || !site || !linesValid}>
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
      <div className="space-y-2">
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
        <Button
          variant="outline"
          className={outlineClass}
          onClick={() => {
            setError('')
            setAttempt((count) => count + 1)
          }}
        >
          Retry
        </Button>
      </div>
    ) : (
      <p role="status" className="text-sm text-slate-600">
        Loading EPR report.
      </p>
    )
  }

  const submitted = data.status === 'submitted'
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm font-semibold text-teal-800">
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
            <p className="text-sm text-slate-600">No adjustments recorded.</p>
          )}
          {data.adjustments.map((entry) => (
            <div
              key={entry.id}
              className="break-words rounded-lg border border-slate-200 p-3 text-sm"
            >
              <p className="font-medium">
                {metricLabels[entry.metric]} · {entry.weight_delta_kg > 0 && '+'}
                {numberFormat.format(entry.weight_delta_kg)} kg
              </p>
              <p className="text-slate-600">
                Effective {entry.effective_date} ·{' '}
                {data.sites.find((site) => site.id === entry.site_id)?.label}
              </p>
              <p>{entry.reason}</p>
              <p className="text-xs text-slate-600">
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
      <p className="text-xs text-slate-600">
        {data.actors.length
          ? 'Select the account to record in this demo.'
          : 'Create a manager or admin account to record changes.'}
      </p>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
      {action === 'confirm-submit' && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm">
            Submit Q{quarter} {year} for all sites? The original totals will be locked. Future
            corrections require an adjustment.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className={outlineClass}
              disabled={pending}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button
              className={primaryClass}
              disabled={pending || !actor}
              onClick={() => void save(() => submitEprQuarter(year, quarter, Number(actor)))}
            >
              {pending ? 'Submitting…' : 'Confirm submit and lock'}
            </Button>
          </div>
        </div>
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
            className={primaryClass}
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
        <Button variant="outline" size="sm" className={outlineClass}>
          <ClipboardList aria-hidden="true" />
          Manage EPR Report
        </Button>
      </DialogTrigger>
      <DialogContent
        overlayClassName="bg-black/20"
        className="max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border-slate-200 bg-white p-5 text-slate-900 sm:rounded-2xl sm:p-6 [&>button]:cursor-pointer [&>button]:text-slate-600"
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Manage EPR Report</DialogTitle>
          <DialogDescription className="text-slate-600">
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
