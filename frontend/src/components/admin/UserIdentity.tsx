import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { TeamUser } from '@/types/user'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface UserIdentityProps {
  user: TeamUser
  /** Replaces the name line, for example to add the role. */
  title?: ReactNode
  /** Replaces the email line, for example to add the store. */
  meta?: ReactNode
  className?: string
}

/** A user's initials avatar with their name and email. */
export function UserIdentity({ user, title, meta, className }: UserIdentityProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar aria-hidden="true">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            user.status === 'Active'
              ? 'bg-primary/10 text-primary'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
          )}
        >
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title ?? user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta ?? user.email}</p>
      </div>
    </div>
  )
}
