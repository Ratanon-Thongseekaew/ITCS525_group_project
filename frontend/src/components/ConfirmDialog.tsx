import type { ReactNode } from 'react'
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

interface ConfirmDialogProps {
  title: ReactNode
  description: ReactNode
  confirmLabel: ReactNode
  onConfirm: () => void
  onCancel: () => void
  /** Uses the destructive button for actions that remove or revoke something. */
  destructive?: boolean
  /** Icon before the title. */
  icon?: ReactNode
  /** Classes for the confirm button, such as a bin-type `solid` tone. */
  actionClassName?: string
  /** Extra content between the description and the buttons, such as a summary or a field. */
  children?: ReactNode
}

/**
 * An "are you sure" dialog. Render it while the question is open and remove it in `onConfirm` and
 * `onCancel`. Confirming calls only `onConfirm`; Cancel, Escape, and clicking outside call
 * `onCancel`.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  icon,
  actionClassName,
  children,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            className={actionClassName}
            onClick={(event) => {
              // Radix would close the dialog through onOpenChange, which also calls onCancel.
              event.preventDefault()
              onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
