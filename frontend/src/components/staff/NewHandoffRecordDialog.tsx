import { useId, useState, type FormEvent } from 'react'
import { ArchiveRestore, CalendarDays, ChevronDown, Clock, Recycle } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatPackedAt, formatTimeOfDay } from '@/lib/handoff-format'
import { handoffContractors } from '@/lib/mock-contractors'
import type { HandoffBin, NewHandoffRecord } from '@/types/handoff'

// Explicit colours because the shadcn theme tokens these primitives use are not defined in this repo.
const fieldClass =
  'rounded-[10px] border-slate-200 bg-white text-sm font-medium text-slate-900 shadow-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 focus-visible:border-teal-600 focus-visible:ring-2 focus-visible:ring-teal-600/15 aria-invalid:border-red-600'
const controlClass = `h-[52px] px-4 ${fieldClass} [&[data-placeholder]>span]:text-slate-500`
const labelClass = 'text-sm leading-5 font-medium text-slate-900'

const pickupTimeSlots = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? 0 : 30
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: formatTimeOfDay(hours, minutes),
  }
})

type FormField = 'contractor' | 'date' | 'time'
type FormErrors = Partial<Record<FormField, string>>

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs text-red-600">
      {message}
    </p>
  )
}

function SelectedBinSummary({ bin }: { bin: HandoffBin }) {
  return (
    <div className="flex flex-col gap-6 rounded-[10px] border border-slate-200 bg-slate-100 p-5 sm:h-[132px] sm:justify-between sm:gap-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg">
            <Recycle className="size-6 text-amber-600" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-[5px] font-medium">
            <p className="text-lg leading-[21.6px] break-words text-slate-900">#{bin.bin_code}</p>
            <p className="text-sm text-amber-600">Recycling Bin</p>
          </div>
        </div>
        <dl className="flex gap-6">
          <div className="flex flex-col gap-2 sm:w-[110px]">
            <dt className="text-xs text-slate-500">Item Count</dt>
            <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
              {bin.item_count} items
            </dd>
          </div>
          <div className="flex flex-col gap-2 sm:w-[130px]">
            <dt className="text-xs text-slate-500">Grossed Weight</dt>
            <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
              {bin.total_weight_kg}kg
            </dd>
          </div>
        </dl>
      </div>
      <p className="text-xs text-slate-500">Packed at {formatPackedAt(bin.packed_at)}</p>
    </div>
  )
}

interface NewHandoffRecordDialogProps {
  bin: HandoffBin
  // ISO datetime without a UTC offset, used to prefill the pickup date and time.
  defaultPickup: string | null
  onClose: () => void
  onConfirm: (record: NewHandoffRecord) => void
  onCloseAutoFocus: (event: Event) => void
}

export function NewHandoffRecordDialog({
  bin,
  defaultPickup,
  onClose,
  onConfirm,
  onCloseAutoFocus,
}: NewHandoffRecordDialogProps) {
  const defaultTime = defaultPickup?.slice(11, 16) ?? ''
  const [contractorId, setContractorId] = useState('')
  const [date, setDate] = useState(defaultPickup?.slice(0, 10) ?? '')
  const [time, setTime] = useState(
    pickupTimeSlots.some((slot) => slot.value === defaultTime) ? defaultTime : '',
  )
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const id = useId()

  function clearError(field: FormField) {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next: FormErrors = {}

    if (!contractorId) next.contractor = 'Select a contractor.'
    if (!date) next.date = 'Select a pickup date.'
    if (!time) next.time = 'Select a pickup time.'

    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    onConfirm({
      bin_id: bin.id,
      contractor_id: contractorId,
      pickup_at: `${date}T${time}:00`,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="bg-black/20"
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex max-h-[calc(100svh-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-slate-900 sm:max-w-[808px] sm:rounded-2xl [&>button:last-child]:top-[25px] [&>button:last-child]:right-5 sm:[&>button:last-child]:top-[35px] sm:[&>button:last-child]:right-8"
      >
        <DialogHeader className="shrink-0 space-y-0 px-5 pt-[22px] pb-4 text-left sm:px-8 sm:pt-8">
          <DialogTitle className="text-lg leading-[21.6px] font-medium tracking-normal text-slate-900">
            New Handoff Record
          </DialogTitle>
          <DialogDescription className="sr-only">
            Assign a contractor and pickup time for bin #{bin.bin_code}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 sm:p-8">
            <SelectedBinSummary bin={bin} />

            <div className="flex flex-col gap-2.5">
              <Label htmlFor={`${id}-contractor`} className={labelClass}>
                Contractor
              </Label>
              <Select
                value={contractorId}
                onValueChange={(value) => {
                  setContractorId(value)
                  clearError('contractor')
                }}
              >
                <SelectTrigger
                  id={`${id}-contractor`}
                  className={controlClass}
                  aria-invalid={Boolean(errors.contractor)}
                  aria-describedby={errors.contractor ? `${id}-contractor-error` : undefined}
                >
                  <SelectValue placeholder="Select a contractor" />
                </SelectTrigger>
                <SelectContent>
                  {handoffContractors.map((contractor) => (
                    <SelectItem key={contractor.id} value={contractor.id}>
                      {contractor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id={`${id}-contractor-error`} message={errors.contractor} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <div className="flex min-w-0 flex-col gap-2.5">
                <Label htmlFor={`${id}-date`} className={labelClass}>
                  Pickup Date
                </Label>
                <div className="relative">
                  <CalendarDays
                    className="pointer-events-none absolute top-[17px] left-4 z-10 size-[18px] text-slate-500"
                    aria-hidden="true"
                  />
                  {/* The native picker icon is stretched and hidden so the whole field opens it. */}
                  <Input
                    id={`${id}-date`}
                    type="date"
                    value={date}
                    aria-invalid={Boolean(errors.date)}
                    aria-describedby={errors.date ? `${id}-date-error` : undefined}
                    className={`relative h-[52px] pr-10 pl-[46px] md:text-sm ${fieldClass} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                    onChange={(event) => {
                      setDate(event.target.value)
                      clearError('date')
                    }}
                  />
                  <ChevronDown
                    className="pointer-events-none absolute top-[18px] right-4 size-4 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
                <FieldError id={`${id}-date-error`} message={errors.date} />
              </div>

              <div className="flex min-w-0 flex-col gap-2.5">
                <Label htmlFor={`${id}-time`} className={labelClass}>
                  Pickup Time
                </Label>
                <Select
                  value={time}
                  onValueChange={(value) => {
                    setTime(value)
                    clearError('time')
                  }}
                >
                  <SelectTrigger
                    id={`${id}-time`}
                    className={controlClass}
                    aria-invalid={Boolean(errors.time)}
                    aria-describedby={errors.time ? `${id}-time-error` : undefined}
                  >
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
                <FieldError id={`${id}-time-error`} message={errors.time} />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <Label htmlFor={`${id}-notes`} className={labelClass}>
                Notes <span className="font-normal text-slate-500">(Optional)</span>
              </Label>
              <Textarea
                id={`${id}-notes`}
                value={notes}
                className={`h-[102px] shrink-0 px-4 py-3 md:text-sm ${fieldClass} font-normal`}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 rounded-xl border-t border-slate-200 bg-slate-100 p-5 sm:p-8">
            <Button
              type="submit"
              // Inline because the global button colour rule in styles.css overrides text-white.
              style={{ color: '#ffffff' }}
              className="h-[52px] w-full gap-1.5 rounded-[10px] bg-teal-700 px-2.5 shadow-none hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <ArchiveRestore aria-hidden="true" />
              Confirm Handoff
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
