import { useId } from 'react'
import { MapPin, UserRound } from 'lucide-react'
import { ErrorState } from '@/components/LoadState'
import { TemporaryAccountPicker } from '@/components/TemporaryAccountPicker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { HandoffWorkspace } from '@/lib/use-handoff-workspace'

/** Chooses which staff member is working, until the frontend uses real login. */
export function HandoffActorBar({ workspace }: { workspace: HandoffWorkspace }) {
  const id = useId()
  const noticeId = `${id}-notice`
  const { staffAccounts, isLoading, error, retry, actor, siteName } = workspace

  if (error) return <ErrorState message={error} onRetry={retry} />

  let message: string | null = null
  if (!isLoading && !actor) {
    message = staffAccounts.length
      ? 'Choose your staff account to see your site’s bins.'
      : 'No staff accounts exist yet.'
  } else if (actor && !siteName) {
    message = 'This staff account isn’t assigned to a site.'
  }

  return (
    <TemporaryAccountPicker role="Staff" noticeId={noticeId} message={message}>
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <Label
          htmlFor={id}
          className="flex items-center gap-1.5 font-normal whitespace-nowrap text-muted-foreground"
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
            className="bg-background sm:w-auto sm:min-w-[240px]"
          >
            <SelectValue placeholder={isLoading ? 'Loading staff…' : 'Choose your account'} />
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
        <p className="flex items-center gap-1.5 text-sm">
          <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
          {siteName}
        </p>
      ) : null}
    </TemporaryAccountPicker>
  )
}
