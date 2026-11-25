import type { ReactNode } from 'react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  children: ReactNode
  icon?: ReactNode
  className?: string
}

/** A dashed placeholder for a list with nothing in it. */
export function EmptyState({ children, icon, className }: EmptyStateProps) {
  return (
    <Empty className={cn('border p-6 md:p-8', className)}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
