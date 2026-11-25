import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TableCardProps {
  title: ReactNode
  description?: ReactNode
  /** Filters or a short label beside the title. */
  actions?: ReactNode
  /** Line under the table, such as a record count. */
  footer?: ReactNode
  /**
   * A `Table` from `components/ui/table`. It scrolls sideways on its own; give it a minimum
   * width such as `className="min-w-[900px]"` to keep columns readable.
   */
  children: ReactNode
  className?: string
}

/** A titled card around a horizontally scrolling table. */
export function TableCard({
  title,
  description,
  actions,
  footer,
  children,
  className,
}: TableCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="p-0">
        {children}
        {footer ? <div className="px-5 py-3 text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  )
}
