import { useState, type FormEvent } from 'react'
import { Recycle, Sparkles, Wrench } from 'lucide-react'
import type { BinType } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { cn } from '@/lib/utils'

const BIN_TYPE_OPTIONS = [
  { type: 'resale', label: 'Direct Resale', icon: Sparkles },
  { type: 'recycle', label: 'Recycling', icon: Recycle },
  { type: 'repair', label: 'Repair', icon: Wrench },
] as const

export interface NewBinValues {
  bin_type: BinType
  max_capacity: number
  notes?: string
}

interface NewBinDialogProps {
  onCreate: (values: NewBinValues) => void
  onCancel: () => void
}

/** Registers an empty bin for counter sorting. */
export function NewBinDialog({ onCreate, onCancel }: NewBinDialogProps) {
  const [type, setType] = useState<BinType>('resale')
  const [capacity, setCapacity] = useState('50')
  const [notes, setNotes] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onCreate({
      bin_type: type,
      max_capacity: parseInt(capacity, 10) || 50,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Bin Record</DialogTitle>
          <DialogDescription>
            Register an empty bin for counter sorting. Its code is generated from your store code.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel id="new-bin-type-label">Bin Destination Type</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={2}
                value={type}
                onValueChange={(value) => value && setType(value as BinType)}
                aria-labelledby="new-bin-type-label"
                className="grid w-full grid-cols-3"
              >
                {BIN_TYPE_OPTIONS.map(({ type: option, label, icon: Icon }) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className={cn('h-10 text-xs font-semibold', BIN_TYPE_TONES[option].toggleOn)}
                  >
                    <Icon aria-hidden="true" />
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="modal-capacity">Target Max Capacity (items)</FieldLabel>
              <Input
                id="modal-capacity"
                type="number"
                min="1"
                max="500"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="modal-notes">Notes / Location (optional)</FieldLabel>
              <Input
                id="modal-notes"
                placeholder="e.g. Counter station 2"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Bin</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
