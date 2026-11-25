import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

export interface PageBreadcrumb {
  label: string
  /** Route to link to. The last crumb is always the current page and never links. */
  to?: string
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode
  breadcrumbs?: readonly PageBreadcrumb[]
  /** Buttons or links shown beside the title, or below it on narrow screens. */
  actions?: ReactNode
  className?: string
}

/** Breadcrumb, title, description, and actions shared by workspace pages. */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {breadcrumbs?.length ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1

              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <BreadcrumbSeparator>/</BreadcrumbSeparator> : null}
                  <BreadcrumbItem>
                    {isCurrent ? (
                      // Plain text with aria-current: the upstream role="link" would make it a fake link.
                      <BreadcrumbPage
                        role={undefined}
                        aria-disabled={undefined}
                        className="font-medium"
                      >
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : crumb.to ? (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.to}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <span>{crumb.label}</span>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? (
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">{actions}</div>
        ) : null}
      </header>
    </div>
  )
}
