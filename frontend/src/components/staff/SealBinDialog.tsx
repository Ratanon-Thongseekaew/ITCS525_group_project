import { useState } from 'react'
import { Archive, ArrowRight } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
    <ConfirmDialog
      icon={<Archive className="size-5 text-recycle" aria-hidden="true" />}
      title="Seal and Close Bin"
      description="Mark this bin as completed. It will no longer accept new items and becomes ready for downstream processing."
      confirmLabel={
        <>
          <ArrowRight aria-hidden="true" />
          Confirm & Seal
        </>
      }
      actionClassName={BIN_TYPE_TONES.recycle.solid}
      onConfirm={() => onConfirm(notes.trim() || undefined)}
      onCancel={onCancel}
    >
      <Field>
        <FieldLabel htmlFor="close-notes">Closure Notes (optional)</FieldLabel>
        <Input
          id="close-notes"
          placeholder="e.g. Full capacity reached, shifted to backroom"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>
    </ConfirmDialog>
  )
}
