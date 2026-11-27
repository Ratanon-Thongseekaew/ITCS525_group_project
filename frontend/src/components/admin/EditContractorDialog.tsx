import { useState, type FormEvent } from 'react'
import { ApiError, type Contractor, type ContractorUpdateRequest } from '@/api'
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
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormField } from './FormField'
import { emailPattern, errorProps } from './form-errors'

interface EditContractorDialogProps {
  contractor: Contractor
  onClose: () => void
  onSave: (changes: ContractorUpdateRequest) => Promise<void>
}

/** Edits a contractor's name and contact details. Only changed fields are sent. */
export function EditContractorDialog({ contractor, onClose, onSave }: EditContractorDialogProps) {
  const [name, setName] = useState(contractor.name)
  const [contactName, setContactName] = useState(contractor.contact_name ?? '')
  const [email, setEmail] = useState(contractor.contact_email ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const cleanEmail = email.trim().toLowerCase()
  const emailError =
    cleanEmail && !emailPattern.test(cleanEmail) ? 'Enter a valid email address.' : undefined
  const canSave = name.trim() !== '' && !emailError && !isSaving

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return

    const changes: ContractorUpdateRequest = {}
    if (name.trim() !== contractor.name) changes.name = name.trim()
    if (contactName.trim() !== (contractor.contact_name ?? '')) {
      changes.contact_name = contactName.trim() || null
    }
    if (cleanEmail !== (contractor.contact_email ?? '')) changes.contact_email = cleanEmail || null

    setError(null)
    setIsSaving(true)
    try {
      await onSave(changes)
    } catch (caught) {
      setError(
        (caught instanceof ApiError && caught.detail) ||
          'Could not save the contractor. Try again.',
      )
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit contractor</DialogTitle>
          <DialogDescription>Update the company name and contact details.</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FieldGroup className="gap-4">
            <FormField id="edit-contractor-name" label="Company name">
              <Input
                id="edit-contractor-name"
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
            <FormField id="edit-contractor-contact" label="Contact name (optional)">
              <Input
                id="edit-contractor-contact"
                maxLength={120}
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </FormField>
            <FormField
              id="edit-contractor-email"
              label="Contact email (optional)"
              error={emailError}
            >
              <Input
                id="edit-contractor-email"
                type="email"
                maxLength={255}
                value={email}
                {...errorProps('edit-contractor-email', emailError)}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
