import { useId, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'

interface PageSectionProps {
  title: ReactNode
  /** Supporting line under the heading. */
  description?: ReactNode
  /** Lets a page move focus to the heading, for example after removing the focused item. */
  headingRef?: Ref<HTMLHeadingElement>
  /** Filters or buttons beside the heading. */
  actions?: ReactNode
  /** Line under the content, such as a record count. */
  footer?: ReactNode
  /** Adds a top border, to separate the section from the page header. */
  bordered?: boolean
  children?: ReactNode
  className?: string
}

/** A titled section of a workspace page. */
export function PageSection({
  title,
  description,
  headingRef,
  actions,
  footer,
  bordered = false,
  children,
  className,
}: PageSectionProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-4', bordered && 'border-t pt-4', className)}
    >
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className="text-sm font-medium text-foreground outline-none"
          >
            {title}
          </h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </section>
  )
}
