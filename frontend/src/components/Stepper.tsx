import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StepperStep {
  title: string
  description?: string
}

interface StepperProps {
  steps: readonly StepperStep[]
  /** 1-based number of the current step. */
  current: number
  className?: string
}

/** Progress through a multi-step flow. Earlier steps show a check; the current one is highlighted. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('grid grid-cols-1 gap-3 sm:grid-cols-3', className)}>
      {steps.map((step, index) => {
        const number = index + 1
        const isCurrent = number === current
        const isDone = number < current

        return (
          <li
            key={step.title}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3.5 shadow-xs transition-colors',
              isCurrent && 'border-primary bg-primary text-primary-foreground',
              isDone && 'border-primary/30 bg-primary/10',
              !isCurrent && !isDone && 'bg-card',
            )}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                isCurrent && 'bg-primary-foreground text-primary',
                isDone && 'bg-primary text-primary-foreground',
                !isCurrent && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {isDone ? <Check className="size-4" aria-label="Completed" /> : number}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  'text-xs leading-tight font-bold',
                  !isCurrent && (isDone ? 'text-primary' : 'text-foreground'),
                )}
              >
                {step.title}
              </span>
              {step.description ? (
                <span
                  className={cn(
                    'mt-0.5 text-xs',
                    isCurrent ? 'text-primary-foreground/80' : 'text-muted-foreground',
                  )}
                >
                  {step.description}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
