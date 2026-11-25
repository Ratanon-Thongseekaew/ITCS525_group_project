import { useState } from 'react'
import { CalendarDays, Calculator, Check } from 'lucide-react'
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
import type { DirectResaleBin } from '@/lib/mock-direct-resale-bins'

const KEYPAD_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '+']

interface DirectResaleProcessDialogProps {
  bin: DirectResaleBin
  onClose: () => void
  /** Called with the potential revenue in baht. */
  onConfirm: (revenue: number) => void
}

/** Records the accepted and rejected counts and the potential revenue of a direct resale bin. */
export function DirectResaleProcessDialog({
  bin,
  onClose,
  onConfirm,
}: DirectResaleProcessDialogProps) {
  const [accepted, setAccepted] = useState(String(bin.count - 2))
  const [rejected, setRejected] = useState('2')
  const [revenue, setRevenue] = useState('15000')
  const [notes, setNotes] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)
  const countsMatch = Number(accepted) + Number(rejected) === bin.count

  function pressKey(key: string) {
    if (key === 'C') setRevenue('0')
    else if (key !== '+') setRevenue((current) => `${current === '0' ? '' : current}${key}`)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 p-5 pb-4 sm:p-6 sm:pb-4">
          <DialogTitle>Process Resale Bin</DialogTitle>
          <DialogDescription>
            Record the item counts and potential revenue for this bin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-5 sm:px-6">
          <BinSummary
            type="resale"
            code={bin.id}
            itemCount={bin.count}
            weightKg={bin.weight}
            detail="Resale Bin"
            footer={`Packed at ${bin.packed}`}
          />

          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="resale-accepted">Accepted Item Count</FieldLabel>
              <Input
                id="resale-accepted"
                type="number"
                min="0"
                value={accepted}
                onChange={(event) => setAccepted(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-rejected">Rejected Item Count</FieldLabel>
              <Input
                id="resale-rejected"
                type="number"
                min="0"
                value={rejected}
                onChange={(event) => setRejected(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-revenue">Potential Revenue</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="resale-revenue"
                  type="number"
                  min="0"
                  value={revenue}
                  onChange={(event) => setRevenue(event.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>฿</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="resale-keypad-toggle">Or Use Running-Sum Keypad</FieldLabel>
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
                aria-label="Running-sum keypad"
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
                <InputGroupInput id="resale-date" type="date" defaultValue="2026-10-20" />
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
            Accepted and rejected item counts should total {bin.count} items.
          </FieldDescription>
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/50 p-5 sm:p-6">
          <Button
            type="button"
            className="w-full"
            disabled={!countsMatch}
            onClick={() => onConfirm(Number(revenue))}
          >
            <Check aria-hidden="true" /> Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
