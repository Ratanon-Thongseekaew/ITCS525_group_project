import type { ReactNode } from 'react'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'

interface FormFieldProps {
  id: string
  label: string
  error?: string
  children: ReactNode
}

/** A labelled admin form field that shows its validation error below the control. */
export function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <Field data-invalid={Boolean(error) || undefined} className="gap-2">
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${id}-error`} className="text-xs">
          {error}
        </FieldError>
      ) : null}
    </Field>
  )
}
