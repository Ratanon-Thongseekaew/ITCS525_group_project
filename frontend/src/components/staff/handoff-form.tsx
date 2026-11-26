import { useId, type FormEvent, type ReactNode } from 'react'
import {
  CalendarDays,
  CircleAlert,
  Clock,
  Recycle,
  Shirt,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import type { BinType } from '@/api'
import { RecordDetail } from '@/components/RecordCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { formatTimeOfDay, formatWeightDifference } from '@/lib/handoff-format'
import { getWeightDifferenceKg, getWeightVariancePercent } from '@/lib/handoff-records'
import { parseWeight, type PickupEvidence, type PickupEvidenceErrors } from '@/lib/handoff-evidence'
import { cn } from '@/lib/utils'
import {
  DISPUTE_THRESHOLD_PERCENT,
  SCALE_PHOTO_TYPES,
  type HandoffContractorOption,
} from '@/types/handoff'

const pickupTimeSlots = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? 0 : 30
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: formatTimeOfDay(hours, minutes),
  }
})

interface FormFieldProps {
  id: string
  label: ReactNode
  error?: string
  description?: ReactNode
  children: ReactNode
}

function FormField({ id, label, error, description, children }: FormFieldProps) {
  return (
    <Field data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

function errorProps(id: string, error?: string) {
  return {
    'aria-invalid': Boolean(error),
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}

const BIN_TYPE_ICONS: Record<BinType, typeof Recycle> = {
  resale: Shirt,
  recycle: Recycle,
  repair: Wrench,
}

interface BinSummaryProps {
  code: string
  itemCount: number
  weightKg: number
  weightLabel?: string
  type?: BinType
  detail?: ReactNode
  footer: ReactNode
}

/** The bin a dialog acts on: code, bin type, item count, and weight. */
export function BinSummary({
  code,
  itemCount,
  weightKg,
  weightLabel = 'Grossed Weight',
  type = 'recycle',
  detail,
  footer,
}: BinSummaryProps) {
  const tone = BIN_TYPE_TONES[type]
  const Icon = BIN_TYPE_ICONS[type]

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-lg',
              tone.soft,
            )}
          >
            <Icon className="size-6" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1 font-medium">
            <p className="text-lg break-words text-foreground">#{code}</p>
            <p className="text-sm text-muted-foreground">{detail ?? 'Recycling Bin'}</p>
          </div>
        </div>
        <dl className="flex gap-6">
          <RecordDetail label="Item Count" className="sm:w-[110px]">
            {itemCount} items
          </RecordDetail>
          <RecordDetail label={weightLabel} className="sm:w-[130px]">
            {weightKg}kg
          </RecordDetail>
        </dl>
      </div>
      <p className="text-xs text-muted-foreground">{footer}</p>
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
    <FormField id={id} label="Contractor" error={error}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} {...errorProps(id, error)}>
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
    </FormField>
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
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <FormField id={dateId} label="Pickup Date" error={errors.date}>
        <InputGroup>
          <InputGroupAddon>
            <CalendarDays aria-hidden="true" />
          </InputGroupAddon>
          {/* The native picker icon is stretched and hidden so the whole field opens it. */}
          <InputGroupInput
            id={dateId}
            type="date"
            value={date}
            {...errorProps(dateId, errors.date)}
            className="relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
            onChange={(event) => onDateChange(event.target.value)}
          />
        </InputGroup>
      </FormField>

      <FormField id={timeId} label="Pickup Time" error={errors.time}>
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger id={timeId} {...errorProps(timeId, errors.time)}>
            <span className="flex min-w-0 items-center gap-2">
              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
      </FormField>
    </FieldGroup>
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
    <Alert role="status" variant={disputed ? 'warning' : 'default'}>
      {disputed ? <TriangleAlert aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
      <AlertDescription>
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
      </AlertDescription>
    </Alert>
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
    <FieldSet className="min-w-0 gap-4">
      <FieldLegend>Pickup evidence</FieldLegend>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <FormField id={ids.staffWeight} label="Staff Weight (kg)" error={errors.staffWeight}>
          <Input
            id={ids.staffWeight}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={value.staffWeight}
            {...errorProps(ids.staffWeight, errors.staffWeight)}
            onChange={(event) => update({ staffWeight: event.target.value })}
          />
        </FormField>
        <FormField id={ids.driverWeight} label="Driver Weight (kg)" error={errors.driverWeight}>
          <Input
            id={ids.driverWeight}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.001"
            value={value.driverWeight}
            {...errorProps(ids.driverWeight, errors.driverWeight)}
            onChange={(event) => update({ driverWeight: event.target.value })}
          />
        </FormField>
      </FieldGroup>
      <VariancePreview {...value} />
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <FormField id={ids.driverName} label="Driver Name" error={errors.driverName}>
          <Input
            id={ids.driverName}
            maxLength={120}
            autoComplete="off"
            value={value.driverName}
            {...errorProps(ids.driverName, errors.driverName)}
            onChange={(event) => update({ driverName: event.target.value })}
          />
        </FormField>
        <FormField id={ids.plateNumber} label="Vehicle Plate Number" error={errors.plateNumber}>
          <Input
            id={ids.plateNumber}
            maxLength={32}
            autoComplete="off"
            value={value.plateNumber}
            {...errorProps(ids.plateNumber, errors.plateNumber)}
            onChange={(event) => update({ plateNumber: event.target.value })}
          />
        </FormField>
      </FieldGroup>
      <FormField
        id={ids.photo}
        label="Scale Photo"
        error={errors.photo}
        description="JPEG, PNG, or WebP, up to 5 MB."
      >
        <Input
          id={ids.photo}
          type="file"
          accept={SCALE_PHOTO_TYPES.join(',')}
          capture="environment"
          className="h-auto py-2 file:mr-3 file:h-7 file:rounded-md file:bg-muted file:px-3"
          {...errorProps(ids.photo, errors.photo)}
          onChange={(event) => update({ photo: event.target.files?.[0] ?? null })}
        />
      </FormField>
    </FieldSet>
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
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 p-5 pb-4 sm:p-6 sm:pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-5 sm:px-6">
            {children}
            {error ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-muted/50 p-5 sm:p-6">
            <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
              {submitIcon}
              {pending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
