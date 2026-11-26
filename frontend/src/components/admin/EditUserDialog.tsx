import { useState, type FormEvent } from 'react'
import { ApiError, type Store, type User, type UserRole, type UserUpdateRequest } from '@/api'
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { OptionSelect } from './OptionSelect'
import { UserIdentity } from './UserIdentity'
import { roleOptions, storeOptions } from './user-options'

interface EditUserDialogProps {
  user: User
  sites: Store[]
  /** Admins can't change their own role here, so they can't lock themselves out. */
  isSelf: boolean
  onClose: () => void
  onSave: (changes: UserUpdateRequest) => Promise<void>
}

/** Edits a user's name, email, role, and (for staff) store. Only changed fields are sent. */
export function EditUserDialog({ user, sites, isSelf, onClose, onSave }: EditUserDialogProps) {
  const [name, setName] = useState(user.full_name ?? '')
  const [email, setEmail] = useState(user.username)
  const [role, setRole] = useState<UserRole>(user.role)
  const [store, setStore] = useState(user.store ? String(user.store.id) : '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const needsStore = role !== 'admin'
  const canSave = email.trim() !== '' && (!needsStore || store !== '') && !isSaving

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return

    const changes: UserUpdateRequest = {}
    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail !== user.username) changes.username = cleanEmail
    if (name.trim() !== (user.full_name ?? '')) changes.full_name = name.trim() || null
    if (role !== user.role) changes.role = role
    if (needsStore && (role !== user.role || Number(store) !== user.store?.id)) {
      changes.site_id = Number(store)
    }

    setError(null)
    setIsSaving(true)
    try {
      await onSave(changes)
    } catch (caught) {
      setError(
        (caught instanceof ApiError && caught.detail) || 'Could not save the user. Try again.',
      )
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update account access and store assignment.</DialogDescription>
        </DialogHeader>

        <UserIdentity user={user} className="rounded-lg bg-muted/50 p-3" />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="edit-name">Full name</FieldLabel>
              <Input
                id="edit-name"
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="edit-email">Email address</FieldLabel>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="edit-role">Role</FieldLabel>
              <OptionSelect
                id="edit-role"
                value={role}
                options={roleOptions}
                placeholder="Select role"
                disabled={isSelf}
                onChange={(value) => setRole(value as UserRole)}
              />
            </Field>
            {needsStore ? (
              <Field className="gap-2">
                <FieldLabel htmlFor="edit-store">Store</FieldLabel>
                <OptionSelect
                  id="edit-store"
                  value={store}
                  options={storeOptions(sites)}
                  placeholder="Select store"
                  onChange={setStore}
                />
              </Field>
            ) : null}
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
