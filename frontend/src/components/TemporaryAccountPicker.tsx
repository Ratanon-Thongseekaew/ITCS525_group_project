import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface TemporaryAccountPickerProps {
  /** Who signs in here once login exists, such as "Staff" or "Manager". */
  role: string
  /** Id of the notice, so a picker can point `aria-describedby` at it. */
  noticeId: string
  /** The account and site pickers. */
  children: ReactNode
  /** A hint under the pickers, such as "Choose your account". */
  message?: ReactNode
}

/**
 * Stands in for login: the person chooses their account on the page. Remove each use, and this
 * component, once users sign in with their own accounts.
 */
export function TemporaryAccountPicker({
  role,
  noticeId,
  children,
  message,
}: TemporaryAccountPickerProps) {
  return (
    <Alert variant="warning" role="group" aria-label={`${role} account`} className="border-dashed">
      <Info aria-hidden="true" />
      <AlertDescription className="flex flex-col gap-3">
        <p id={noticeId} className="text-xs">
          <Badge variant="warning" className="mr-1.5 border-current/20">
            Temporary
          </Badge>
          {role} login isn’t available yet, so choose your account here. This picker will be
          replaced by signing in.
        </p>
        <div className="flex w-full flex-col gap-3 text-foreground md:flex-row md:flex-wrap md:items-center md:gap-x-6">
          {children}
          {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}
        </div>
      </AlertDescription>
    </Alert>
  )
}
