import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type StatCardTone =
  'default' | 'success' | 'warning' | 'info' | 'destructive' | 'resale' | 'recycle' | 'repair'

const toneClasses: Record<StatCardTone, { card: string; label: string; value: string }> = {
  default: { card: '', label: 'text-muted-foreground', value: 'text-foreground' },
  // Same light and dark pairs as the Badge and Alert status variants.
  success: {
    card: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40',
    label: 'text-emerald-800 dark:text-emerald-300',
    value: 'text-emerald-800 dark:text-emerald-300',
  },
  warning: {
    card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40',
    label: 'text-amber-800 dark:text-amber-300',
    value: 'text-amber-800 dark:text-amber-300',
  },
  info: {
    card: 'border-sky-200 bg-sky-50/60 dark:border-sky-900 dark:bg-sky-950/40',
    label: 'text-sky-800 dark:text-sky-300',
    value: 'text-sky-800 dark:text-sky-300',
  },
  destructive: {
    card: 'border-destructive/30 bg-destructive/5',
    label: 'text-destructive',
    value: 'text-destructive',
  },
  resale: {
    card: 'border-resale/30 bg-resale-soft/40',
    label: 'text-resale-soft-foreground',
    value: 'text-resale-soft-foreground',
  },
  recycle: {
    card: 'border-recycle/30 bg-recycle-soft/40',
    label: 'text-recycle-soft-foreground',
    value: 'text-recycle-soft-foreground',
  },
  repair: {
    card: 'border-repair/30 bg-repair-soft/40',
    label: 'text-repair-soft-foreground',
    value: 'text-repair-soft-foreground',
  },
}

interface StatCardProps {
  label: string
  value: ReactNode
  /** Icon shown beside the label. */
  icon?: ReactNode
  /** Short supporting line under the value. */
  hint?: ReactNode
  /** Content beside the value, such as a link. */
  footer?: ReactNode
  tone?: StatCardTone
  className?: string
}

/**
 * One summary metric. Render several inside a `dl` grid: the label is a `dt` and the value a
 * `dd`, so `getByText(label).nextElementSibling` finds the value.
 */
export function StatCard({
  label,
  value,
  icon,
  hint,
  footer,
  tone = 'default',
  className,
}: StatCardProps) {
  const classes = toneClasses[tone]

  return (
    <Card className={cn(classes.card, className)}>
      <CardContent className="flex h-full min-h-32 flex-col justify-between gap-3 p-5">
        <dt className={cn('flex items-center justify-between gap-2 text-sm', classes.label)}>
          {label}
          {icon ? (
            <span className="shrink-0 [&_svg]:size-4" aria-hidden="true">
              {icon}
            </span>
          ) : null}
        </dt>
        <dd className="flex flex-col gap-1">
          <span className="flex flex-wrap items-end justify-between gap-2">
            <span className={cn('text-2xl font-semibold tracking-tight', classes.value)}>
              {value}
            </span>
            {footer}
          </span>
          {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
        </dd>
      </CardContent>
    </Card>
  )
}
