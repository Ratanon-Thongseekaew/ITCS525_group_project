import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Explicit colours because the outline Button's theme tokens are not defined in this repo.
export const actionButtonClass =
  'h-10 gap-1.5 rounded-[10px] border-slate-200 bg-white px-2.5 text-slate-900 shadow-none hover:bg-slate-50 hover:text-slate-900'
export const cardClass = 'rounded-[14px] shadow-xs'

interface BinDetailProps {
  label: string
  value: string
  widthClass: string
}

export function BinDetail({ label, value, widthClass }: BinDetailProps) {
  return (
    <div className={`flex flex-col gap-2 ${widthClass}`}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg leading-[21.6px] font-medium whitespace-nowrap text-slate-900">
        {value}
      </dd>
    </div>
  )
}

interface LoadStateProps {
  isLoading: boolean
  error: string | null
  loadingLabel: string
  onRetry: () => void
}

/** Loading and error-with-retry states for the handoff lists. Renders nothing once loaded. */
export function LoadState({ isLoading, error, loadingLabel, onRetry }: LoadStateProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-800"
      >
        <p>{error}</p>
        <Button type="button" variant="outline" className={actionButtonClass} onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }
  if (isLoading) {
    return (
      <p role="status" className="py-8 text-center text-sm text-slate-500">
        {loadingLabel}
      </p>
    )
  }
  return null
}
