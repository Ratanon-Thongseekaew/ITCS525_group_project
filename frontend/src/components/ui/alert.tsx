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
        // Project addition: status variants built on the --success, --warning and --info tokens.
        success:
          'border-success/30 bg-success-soft/60 text-success-soft-foreground *:data-[slot=alert-description]:text-success-soft-foreground/90',
        warning:
          'border-warning/30 bg-warning-soft/60 text-warning-soft-foreground *:data-[slot=alert-description]:text-warning-soft-foreground/90',
        info: 'border-info/30 bg-info-soft/60 text-info-soft-foreground *:data-[slot=alert-description]:text-info-soft-foreground/90',
        // Project addition: bin-type variants built on the --resale, --recycle and --repair tokens.
        resale:
          'border-resale/30 bg-resale-soft text-resale-soft-foreground *:data-[slot=alert-description]:text-resale-soft-foreground/90',
        recycle:
          'border-recycle/30 bg-recycle-soft text-recycle-soft-foreground *:data-[slot=alert-description]:text-recycle-soft-foreground/90',
        repair:
          'border-repair/30 bg-repair-soft text-repair-soft-foreground *:data-[slot=alert-description]:text-repair-soft-foreground/90',
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
