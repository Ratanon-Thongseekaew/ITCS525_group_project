import { useState } from 'react'
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
import { stores, userRoles, type TeamUser } from '@/types/user'
import { OptionSelect } from './OptionSelect'
import { UserIdentity } from './UserIdentity'

interface EditUserDialogProps {
  user: TeamUser
  onClose: () => void
  onSave: (user: TeamUser) => void
}

/** Edits a user's name, email, role, and store. */
export function EditUserDialog({ user, onClose, onSave }: EditUserDialogProps) {
  const [draft, setDraft] = useState(user)
  const canSave = draft.name.trim() !== '' && draft.email.includes('@')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update account access and store assignment.</DialogDescription>
        </DialogHeader>

        <UserIdentity user={user} className="rounded-lg bg-muted/50 p-3" />

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field className="gap-2">
            <FieldLabel htmlFor="edit-name">Full name</FieldLabel>
            <Input
              id="edit-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="edit-email">Email address</FieldLabel>
            <Input
              id="edit-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="edit-role">Role</FieldLabel>
            <OptionSelect
              id="edit-role"
              value={draft.role}
              options={userRoles}
              placeholder="Select role"
              onChange={(role) => setDraft({ ...draft, role })}
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="edit-store">Store</FieldLabel>
            <OptionSelect
              id="edit-store"
              value={draft.store}
              options={stores}
              placeholder="Select store"
              onChange={(store) => setDraft({ ...draft, store })}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
