import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
        // Project addition: status variants with light and dark pairs (see AI_README.md).
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-900 *:data-[slot=alert-description]:text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 dark:*:data-[slot=alert-description]:text-emerald-300',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:*:data-[slot=alert-description]:text-amber-300',
        info: 'border-sky-200 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200 dark:*:data-[slot=alert-description]:text-sky-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

// Project deviation: upstream renders a div; this project keeps an h5 so alert titles stay headings.
function AlertTitle({ className, ...props }: React.ComponentProps<'h5'>) {
  return (
    <h5
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
