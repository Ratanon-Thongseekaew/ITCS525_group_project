import { useState } from 'react'
import { CalendarDays, Calculator, Check } from 'lucide-react'
import { toast } from 'sonner'
import { processDirectResaleBin, type DirectResaleBinRecord } from '@/api'
import { BinSummary } from '@/components/staff/handoff-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Textarea } from '@/components/ui/textarea'
import { formatPackedAt } from '@/lib/handoff-format'

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '00']

interface DirectResaleProcessDialogProps {
  bin: DirectResaleBinRecord
  actorId: number
  onClose: () => void
  onProcessed: () => void
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Records item counts and revenue, then persists the processing through the API. */
export function DirectResaleProcessDialog({
  bin,
  actorId,
  onClose,
  onProcessed,
}: DirectResaleProcessDialogProps) {
  const [accepted, setAccepted] = useState(String(bin.item_count))
  const [rejected, setRejected] = useState('0')
  const [revenue, setRevenue] = useState('')
  const [processDate, setProcessDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const countsMatch = Number(accepted) + Number(rejected) === bin.item_count
  const validCounts = [accepted, rejected].every((value) => /^\d+$/.test(value))
  const validRevenue = revenue !== '' && Number.isFinite(Number(revenue)) && Number(revenue) >= 0

  function updateCount(field: 'accepted' | 'rejected', value: string) {
    if (field === 'accepted') setAccepted(value)
    else setRejected(value)
    if (value === '' || !/^\d+$/.test(value)) return
    const bounded = Math.min(bin.item_count, Number(value))
    if (field === 'accepted') {
      setAccepted(String(bounded))
      setRejected(String(bin.item_count - bounded))
    } else {
      setRejected(String(bounded))
      setAccepted(String(bin.item_count - bounded))
    }
  }

  function pressKey(key: string) {
    if (key === 'C') setRevenue('')
    else setRevenue((current) => `${current === '0' ? '' : current}${key}`)
  }

  async function confirmProcess() {
    if (!validCounts || !countsMatch || !validRevenue || !processDate || isSaving) return
    setIsSaving(true)
    try {
      await processDirectResaleBin(bin.id, {
        actor_id: actorId,
        accepted_item_count: Number(accepted),
        rejected_item_count: Number(rejected),
        revenue: Number(revenue),
        processed_at: processDate,
        notes: notes.trim() || undefined,
      })
      onProcessed()
      toast.success('Resale bin processed and saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save resale bin processing.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 p-5 pb-4 sm:p-6 sm:pb-4">
          <DialogTitle>Process Resale Bin</DialogTitle>
          <DialogDescription>
            Record the accepted and rejected item counts and sale revenue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-5 sm:px-6">
          <BinSummary
            type="resale"
            code={bin.bin_code}
            itemCount={bin.item_count}
            weightKg={bin.total_weight_kg}
            detail="Resale Bin"
            footer={`Packed at ${formatPackedAt(bin.packed_at)}`}
          />
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="resale-accepted">Accepted Item Count</FieldLabel>
              <Input
                id="resale-accepted"
                type="number"
                min="0"
                max={bin.item_count}
                step="1"
                value={accepted}
                onChange={(event) => updateCount('accepted', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-rejected">Rejected Item Count</FieldLabel>
              <Input
                id="resale-rejected"
                type="number"
                min="0"
                max={bin.item_count}
                step="1"
                value={rejected}
                onChange={(event) => updateCount('rejected', event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-revenue">Sale Revenue (฿)</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="resale-revenue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenue}
                  onChange={(event) => setRevenue(event.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>฿</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-keypad-toggle">Quick Amount Keypad</FieldLabel>
              <Button
                id="resale-keypad-toggle"
                type="button"
                variant="secondary"
                aria-expanded={keypadOpen}
                onClick={() => setKeypadOpen((open) => !open)}
              >
                <Calculator aria-hidden="true" /> {keypadOpen ? 'Close' : 'Open'}
              </Button>
            </Field>
            {keypadOpen ? (
              <div
                className="grid grid-cols-3 gap-2 sm:col-span-2"
                role="group"
                aria-label="Quick amount keypad"
              >
                {KEYPAD_KEYS.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant="outline"
                    className="h-12 text-base"
                    onClick={() => pressKey(key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="resale-date">Process Date</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <CalendarDays aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id="resale-date"
                  type="date"
                  value={processDate}
                  onChange={(event) => setProcessDate(event.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-notes">
                Notes <span className="font-normal text-muted-foreground">(Optional)</span>
              </FieldLabel>
              <Textarea
                id="resale-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <FieldDescription className={countsMatch ? undefined : 'text-destructive'}>
            Accepted and rejected item counts must total {bin.item_count} items.
          </FieldDescription>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/50 p-5 sm:p-6">
          <Button
            type="button"
            className="w-full"
            disabled={isSaving || !validCounts || !countsMatch || !validRevenue || !processDate}
            onClick={confirmProcess}
          >
            <Check aria-hidden="true" /> {isSaving ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
