import { useState } from 'react'
import { Archive, ArrowRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'

interface SealBinDialogProps {
  /** Called with the optional closure notes. */
  onConfirm: (notes: string | undefined) => void
  onCancel: () => void
}

/** Confirms sealing a bin so it stops accepting items and becomes ready downstream. */
export function SealBinDialog({ onConfirm, onCancel }: SealBinDialogProps) {
  const [notes, setNotes] = useState('')

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="size-5 text-recycle" aria-hidden="true" />
            Seal and Close Bin
          </AlertDialogTitle>
          <AlertDialogDescription>
            Mark this bin as completed. It will no longer accept new items and becomes ready for
            downstream processing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="close-notes">Closure Notes (optional)</FieldLabel>
          <Input
            id="close-notes"
            placeholder="e.g. Full capacity reached, shifted to backroom"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={BIN_TYPE_TONES.recycle.solid}
            onClick={() => onConfirm(notes.trim() || undefined)}
          >
            <ArrowRight aria-hidden="true" />
            Confirm & Seal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
