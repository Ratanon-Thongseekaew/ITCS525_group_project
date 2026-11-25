import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RecordDetailProps {
  label: ReactNode
  children: ReactNode
  className?: string
}

/** One label and value pair inside a `RecordCard`'s details list. */
export function RecordDetail({ label, children, className }: RecordDetailProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium whitespace-nowrap text-foreground">{children}</dd>
    </div>
  )
}

interface RecordCardProps {
  /** Icon in the leading tile. */
  icon: ReactNode
  /** Classes for the icon tile, such as a bin-type `soft` tone. */
  iconClassName?: string
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  /** `RecordDetail` items, rendered in a `dl`. */
  details?: ReactNode
  /** Status shown as the last detail, usually a `Badge`. */
  status?: ReactNode
  /** Makes the whole card clickable through a button on the title. */
  onSelect?: (event: MouseEvent<HTMLButtonElement>) => void
  selectDisabled?: boolean
  selectProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'disabled' | 'type'>
  /** Extra content under the main row, such as evidence or alerts. */
  children?: ReactNode
  className?: string
}

/** A bin or record row: icon, identity, details, and status. Shared by the staff workspaces. */
export function RecordCard({
  icon,
  iconClassName,
  title,
  subtitle,
  meta,
  details,
  status,
  onSelect,
  selectDisabled,
  selectProps,
  children,
  className,
}: RecordCardProps) {
  return (
    <Card
      className={cn(
        'relative',
        onSelect && 'transition-colors hover:bg-muted/50 has-[button:disabled]:hover:bg-card',
        className,
      )}
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-6',
                iconClassName,
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-lg font-medium break-words text-foreground">
                {onSelect ? (
                  // Stretched over the card so it stays clickable without nesting details in a button.
                  <button
                    {...selectProps}
                    type="button"
                    disabled={selectDisabled}
                    onClick={onSelect}
                    className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 disabled:cursor-not-allowed"
                  >
                    {title}
                  </button>
                ) : (
                  title
                )}
              </h3>
              {subtitle ? <div className="text-sm font-medium">{subtitle}</div> : null}
              {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
            </div>
          </div>

          {details || status ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:shrink-0 xl:gap-6">
              {details}
              {status ? (
                <RecordDetail label="Status" className="items-start">
                  {status}
                </RecordDetail>
              ) : null}
            </dl>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
