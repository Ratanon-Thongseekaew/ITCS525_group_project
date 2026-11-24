import { useId, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, CircleAlert, Clock, Recycle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatTimeOfDay, formatWeightDifference } from '@/lib/handoff-format'
import { getWeightDifferenceKg, getWeightVariancePercent } from '@/lib/handoff-records'
import { parseWeight, type PickupEvidence, type PickupEvidenceErrors } from '@/lib/handoff-evidence'
import {
  DISPUTE_THRESHOLD_PERCENT,
  SCALE_PHOTO_TYPES,
  type HandoffContractorOption,
} from '@/types/handoff'

// Explicit colours because the shadcn theme tokens these primitives use are not defined in this repo.
export const fieldClass =
  'rounded-[10px] border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/15 aria-invalid:border-red-600'
const controlClass = `h-[52px] px-4 ${fieldClass} [&[data-placeholder]>span]:text-slate-500`
const inputClass = `h-[52px] px-4 md:text-sm ${fieldClass}`
const labelClass = 'text-sm leading-5 font-medium text-slate-900'

const pickupTimeSlots = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? 0 : 30
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: formatTimeOfDay(hours, minutes),
  }
})

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {message}
    </p>
  )
}

interface FieldProps {
  id: string
  label: ReactNode
  error?: string
  children: ReactNode
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Label htmlFor={id} className={labelClass}>
        {label}
      </Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function errorProps(id: string, error?: string) {
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}

interface BinSummaryProps {
  code: string
  itemCount: number
  weightKg: number
  weightLabel?: string
  detail?: ReactNode
  footer: ReactNode
}

export function BinSummary({
  code,
  itemCount,
  weightKg,
  weightLabel = 'Grossed Weight',
  detail,
  footer,
}: BinSummaryProps) {
  return (
    <div className="flex flex-col gap-6 rounded-[10px] border border-slate-200 bg-slate-100 p-5 sm:min-h-[132px] sm:justify-between sm:gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg">
            <Recycle className="size-6 text-amber-600" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-[5px] font-medium">
            <p className="text-lg leading-[21.6px] break-words text-slate-900">#{code}</p>
            <p className="text-sm text-amber-600">{detail ?? 'Recycling Bin'}</p>
          </div>
        </div>
        <dl className="flex gap-6">
          <div className="flex flex-col gap-2 sm:w-[110px]">
            <dt className="text-xs text-slate-500">Item Count</dt>
            <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
              {itemCount} items
            </dd>
          </div>
          <div className="flex flex-col gap-2 sm:w-[130px]">
            <dt className="text-xs text-slate-500">{weightLabel}</dt>
            <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
              {weightKg}kg
            </dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-slate-500">{footer}</p>
    </div>
  )
}

interface ContractorFieldProps {
  contractors: readonly HandoffContractorOption[]
  value: string
  error?: string
  onChange: (value: string) => void
}

export function ContractorField({ contractors, value, error, onChange }: ContractorFieldProps) {
  const id = useId()

  return (
    <Field id={id} label="Contractor" error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={controlClass} {...errorProps(id, error)}>
          <SelectValue placeholder="Select a contractor" />
        </SelectTrigger>
        <SelectContent>
          {contractors.map((contractor) => (
            <SelectItem key={contractor.id} value={String(contractor.id)}>
              {contractor.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

interface PickupDateTimeFieldsProps {
  date: string
  time: string
  errors: { date?: string; time?: string }
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
}

export function PickupDateTimeFields({
  date,
  time,
  errors,
  onDateChange,
  onTimeChange,
}: PickupDateTimeFieldsProps) {
  const dateId = useId()
  const timeId = useId()

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
      <Field id={dateId} label="Pickup Date" error={errors.date}>
        <div className="relative">
          <CalendarDays
            className="pointer-events-none absolute top-[17px] left-4 z-10 size-[18px] text-slate-500"
            aria-hidden="true"
          />
          {/* The native picker icon is stretched and hidden so the whole field opens it. */}
          <Input
            id={dateId}
            type="date"
            value={date}
            {...errorProps(dateId, errors.date)}
            className={`relative h-[52px] pr-10 pl-[46px] md:text-sm ${fieldClass} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
            onChange={(event) => onDateChange(event.target.value)}
          />
          <ChevronDown
            className="pointer-events-none absolute top-[18px] right-4 size-4 text-slate-500"
            aria-hidden="true"
          />
        </div>
      </Field>

      <Field id={timeId} label="Pickup Time" error={errors.time}>
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger id={timeId} className={controlClass} {...errorProps(timeId, errors.time)}>
            <span className="flex min-w-0 items-center gap-3">
              <Clock className="size-[18px] shrink-0 text-slate-500" aria-hidden="true" />
              <SelectValue placeholder="Select a time" />
            </span>
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {pickupTimeSlots.map((slot) => (
              <SelectItem key={slot.value} value={slot.value}>
                {slot.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

function VariancePreview({ staffWeight, driverWeight }: PickupEvidence) {
  const staff = parseWeight(staffWeight)
  const driver = parseWeight(driverWeight)
  // The difference is a percentage of the staff weight, so it needs a staff weight above 0.
  if (!staff || driver === null) return null

  const variance = getWeightVariancePercent(staff, driver)
  const disputed = variance > DISPUTE_THRESHOLD_PERCENT

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-[10px] border px-3 py-2 text-sm ${disputed ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
    >
      {disputed ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
      )}
      <p>
        Weight difference:{' '}
        <strong>
          {formatWeightDifference(
            getWeightDifferenceKg(staff, driver),
            variance,
            ' of the staff weight',
          )}
        </strong>
        .{' '}
        {disputed
          ? `Over ${DISPUTE_THRESHOLD_PERCENT}%, so this handoff will be marked Disputed and need manager approval.`
          : `Within ${DISPUTE_THRESHOLD_PERCENT}%.`}
      </p>
    </div>
  )
}

interface PickupEvidenceFieldsProps {
  value: PickupEvidence
  errors: PickupEvidenceErrors
  onChange: (value: PickupEvidence) => void
}

export function PickupEvidenceFields({ value, errors, onChange }: PickupEvidenceFieldsProps) {
  const id = useId()
  const ids = {
    staffWeight: `${id}-staff-weight`,
    driverWeight: `${id}-driver-weight`,
    driverName: `${id}-driver-name`,
    plateNumber: `${id}-plate`,
    photo: `${id}-photo`,
  }

  function update(patch: Partial<PickupEvidence>) {
    onChange({ ...value, ...patch })
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-4 text-sm font-medium text-slate-900">Pickup evidence</legend>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <Field id={ids.staffWeight} label="Staff Weight (kg)" error={errors.staffWeight}>
          <Input
            id={ids.staffWeight}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={value.staffWeight}
            className={inputClass}
            {...errorProps(ids.staffWeight, errors.staffWeight)}
            onChange={(event) => update({ staffWeight: event.target.value })}
          />
        </Field>
        <Field id={ids.driverWeight} label="Driver Weight (kg)" error={errors.driverWeight}>
          <Input
            id={ids.driverWeight}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={value.driverWeight}
            className={inputClass}
            {...errorProps(ids.driverWeight, errors.driverWeight)}
            onChange={(event) => update({ driverWeight: event.target.value })}
          />
        </Field>
      </div>
      <VariancePreview {...value} />
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <Field id={ids.driverName} label="Driver Name" error={errors.driverName}>
          <Input
            id={ids.driverName}
            maxLength={120}
            autoComplete="off"
            value={value.driverName}
            className={inputClass}
            {...errorProps(ids.driverName, errors.driverName)}
            onChange={(event) => update({ driverName: event.target.value })}
          />
        </Field>
        <Field id={ids.plateNumber} label="Vehicle Plate Number" error={errors.plateNumber}>
          <Input
            id={ids.plateNumber}
            maxLength={32}
            autoComplete="off"
            value={value.plateNumber}
            className={inputClass}
            {...errorProps(ids.plateNumber, errors.plateNumber)}
            onChange={(event) => update({ plateNumber: event.target.value })}
          />
        </Field>
      </div>
      <Field id={ids.photo} label="Scale Photo" error={errors.photo}>
        <Input
          id={ids.photo}
          type="file"
          accept={SCALE_PHOTO_TYPES.join(',')}
          capture="environment"
          className={`h-auto px-4 py-3 md:text-sm ${fieldClass} font-normal file:mr-3 file:rounded-md file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-900`}
          {...errorProps(ids.photo, errors.photo)}
          onChange={(event) => update({ photo: event.target.files?.[0] ?? null })}
        />
        <p className="text-xs text-slate-500">JPEG, PNG, or WebP, up to 5 MB.</p>
      </Field>
    </fieldset>
  )
}

interface HandoffDialogShellProps {
  title: string
  description: string
  submitLabel: string
  submitIcon: ReactNode
  pending: boolean
  error: string | null
  onSubmit: () => void
  onClose: () => void
  onCloseAutoFocus?: (event: Event) => void
  children: ReactNode
}

export function HandoffDialogShell({
  title,
  description,
  submitLabel,
  submitIcon,
  pending,
  error,
  onSubmit,
  onClose,
  onCloseAutoFocus,
  children,
}: HandoffDialogShellProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pending) onSubmit()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent
        overlayClassName="bg-black/20"
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[calc(100svh-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-slate-900 sm:max-w-[808px] sm:rounded-2xl [&>button:last-child]:top-[25px] [&>button:last-child]:right-5 sm:[&>button:last-child]:top-[35px] sm:[&>button:last-child]:right-8"
      >
        <DialogHeader className="shrink-0 space-y-0 px-5 pt-[22px] pb-4 text-left sm:px-8 sm:pt-8">
          <DialogTitle className="text-lg leading-[21.6px] font-medium tracking-normal text-slate-900">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-8">
            {children}
            {error ? (
              <p
                role="alert"
                className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 rounded-xl border-t border-slate-200 bg-slate-100 p-5 sm:p-8">
            <Button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              // Inline because the global button colour rule in styles.css overrides text-white.
              style={{ color: '#ffffff' }}
              className="h-[52px] w-full gap-1.5 rounded-[10px] bg-teal-700 px-2.5 shadow-none hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              {submitIcon}
              {pending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
