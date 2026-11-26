import { MapPin, UserRound } from 'lucide-react'
import type { User } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface DirectResaleAccountBarProps {
  user: User | null
}

/** Shows the signed-in staff account and its assigned store on Direct Resale pages. */
export function DirectResaleAccountBar({ user }: DirectResaleAccountBarProps) {
  if (!user || user.role !== 'staff') {
    return (
      <Alert variant="warning">
        <UserRound aria-hidden="true" />
        <AlertDescription>Direct Resale is available to staff accounts only.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
      role="group"
      aria-label="Signed-in staff account"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Staff account</span>
          <span className="truncate text-sm font-medium">{user.full_name || user.username}</span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{user.store?.name ?? 'No store assigned'}</span>
      </div>
    </div>
  )
}
