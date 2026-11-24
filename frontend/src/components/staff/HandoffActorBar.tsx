import { useId } from 'react'
import { Info, MapPin, RefreshCw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { actionButtonClass } from '@/components/staff/handoff-ui'
import type { HandoffWorkspace } from '@/lib/use-handoff-workspace'

/** Chooses which staff member is working, until the frontend uses real login. */
export function HandoffActorBar({ workspace }: { workspace: HandoffWorkspace }) {
  const id = useId()
  const noticeId = `${id}-notice`
  const { staffAccounts, isLoading, error, retry, actor, siteName } = workspace

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
      >
        <span className="min-w-0 flex-1">{error}</span>
        <Button type="button" variant="outline" className={actionButtonClass} onClick={retry}>
          <RefreshCw aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-dashed border-amber-300 bg-amber-50/40 px-4 py-3">
      {/* Remove this picker, and its notice, once staff sign in with their own accounts. */}
      <p id={noticeId} className="flex items-start gap-2 text-xs text-amber-800">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="mr-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-px font-medium">
            Temporary
          </span>
          Staff login isn’t available yet, so choose your account here. This picker will be replaced
          by signing in.
        </span>
      </p>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
        <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Label
            htmlFor={id}
            className="flex items-center gap-1.5 text-sm font-normal whitespace-nowrap text-slate-500"
          >
            <UserRound className="size-4" aria-hidden="true" />
            Staff member
          </Label>
          <Select
            value={actor ? String(actor.id) : ''}
            onValueChange={(value) => workspace.setActorId(Number(value))}
            disabled={isLoading || staffAccounts.length === 0}
          >
            <SelectTrigger
              id={id}
              aria-describedby={noticeId}
              className="h-9 w-full min-w-0 gap-1.5 rounded-[10px] border-slate-200 bg-white py-1.5 pr-2 pl-2.5 shadow-none sm:w-auto sm:min-w-[240px]"
            >
              {/* On a span because the global button font and colour rules override the trigger. */}
              <span className="truncate text-sm font-medium text-slate-900">
                <SelectValue placeholder={isLoading ? 'Loading staff…' : 'Choose your account'} />
              </span>
            </SelectTrigger>
            <SelectContent>
              {staffAccounts.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {siteName ? (
          <p className="flex items-center gap-1.5 text-sm text-slate-700">
            <MapPin className="size-4 text-slate-500" aria-hidden="true" />
            {siteName}
          </p>
        ) : null}
        {!isLoading && !actor ? (
          <p className="text-xs text-amber-700">
            {staffAccounts.length
              ? 'Choose your staff account to see your site’s bins.'
              : 'No staff accounts exist yet.'}
          </p>
        ) : null}
        {actor && !siteName ? (
          <p className="text-xs text-amber-700">This staff account isn’t assigned to a site.</p>
        ) : null}
      </div>
    </div>
  )
}
