import { RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface LoadStateProps {
  isLoading: boolean
  error: string | null
  loadingLabel: string
  onRetry?: () => void
}

/** Loading and error-with-retry states for a list. Renders nothing once loaded. */
export function LoadState({ isLoading, error, loadingLabel, onRetry }: LoadStateProps) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />
  if (isLoading) {
    return (
      <p role="status" className="py-8 text-center text-sm text-muted-foreground">
        {loadingLabel}
      </p>
    )
  }
  return null
}

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

/** A destructive alert with an optional Retry button. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="flex flex-wrap items-center gap-3">
      <AlertDescription className="min-w-0 flex-1 text-sm">{message}</AlertDescription>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </Alert>
  )
}
