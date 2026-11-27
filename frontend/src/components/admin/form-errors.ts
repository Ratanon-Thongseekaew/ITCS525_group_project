export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ARIA attributes that link a control to its `FormField` error message. */
export function errorProps(id: string, error?: string) {
  return {
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}
