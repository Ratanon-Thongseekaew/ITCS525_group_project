import type { ReactNode } from 'react'
import type { User } from '@/api'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface UserIdentityProps {
  user: User
  /** Replaces the name line, for example to add the role. */
  title?: ReactNode
  /** Replaces the email line, for example to add the store. */
  meta?: ReactNode
  className?: string
}

/** A user's initials avatar with their name and email. */
export function UserIdentity({ user, title, meta, className }: UserIdentityProps) {
  const name = user.full_name || user.username

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar aria-hidden="true">
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            user.must_change_password
              ? 'bg-warning-soft text-warning-soft-foreground'
              : 'bg-primary/10 text-primary',
          )}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title ?? name}</p>
        <p className="truncate text-xs text-muted-foreground">{meta ?? user.username}</p>
      </div>
    </div>
  )
}
