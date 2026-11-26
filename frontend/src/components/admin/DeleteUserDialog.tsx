import { Info } from 'lucide-react'
import type { User } from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserIdentity } from './UserIdentity'
import { roleLabels } from './user-options'

interface DeleteUserDialogProps {
  user: User
  onClose: () => void
  onConfirm: () => void
}

/** Confirms removing a user's access. */
export function DeleteUserDialog({ user, onClose, onConfirm }: DeleteUserDialogProps) {
  const name = user.full_name || user.username

  return (
    <ConfirmDialog
      destructive
      title={`Delete ${name}?`}
      description="This user will immediately lose access to Textile Track. This action cannot be undone."
      confirmLabel="Delete user"
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      <UserIdentity
        user={user}
        title={`${name} · ${roleLabels[user.role]}`}
        meta={[user.store?.name, user.username].filter(Boolean).join(' · ')}
        className="rounded-lg bg-muted/50 p-3"
      />
      <Alert variant="info" role="note">
        <Info aria-hidden="true" />
        <AlertDescription className="text-xs">
          Users with recorded bins, garments, handoffs, or reports can&rsquo;t be deleted.
        </AlertDescription>
      </Alert>
    </ConfirmDialog>
  )
}
