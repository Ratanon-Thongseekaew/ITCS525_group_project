import { Info } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { TeamUser } from '@/types/user'
import { UserIdentity } from './UserIdentity'

interface DeleteUserDialogProps {
  user: TeamUser
  onClose: () => void
  onConfirm: () => void
}

/** Confirms removing a user's access. */
export function DeleteUserDialog({ user, onClose, onConfirm }: DeleteUserDialogProps) {
  return (
    <ConfirmDialog
      destructive
      title={`Delete ${user.name}?`}
      description="This user will immediately lose access to Textile Track. This action cannot be undone."
      confirmLabel="Delete user"
      onConfirm={onConfirm}
      onCancel={onClose}
    >
      <UserIdentity
        user={user}
        title={`${user.name} · ${user.role}`}
        meta={`${user.store} · ${user.email}`}
        className="rounded-lg bg-muted/50 p-3"
      />
      <Alert variant="info" role="note">
        <Info aria-hidden="true" />
        <AlertDescription className="text-xs">No data history will be deleted.</AlertDescription>
      </Alert>
    </ConfirmDialog>
  )
}
