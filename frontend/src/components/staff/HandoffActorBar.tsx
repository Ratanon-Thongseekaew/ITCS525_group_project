import { useId } from 'react'
import { Info, MapPin, UserRound } from 'lucide-react'
import { ErrorState } from '@/components/LoadState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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

  return (
    // Remove this picker, and its notice, once staff sign in with their own accounts.
    <Alert variant="warning" role="group" aria-label="Staff account" className="border-dashed">
      <Info aria-hidden="true" />
      <AlertDescription className="flex flex-col gap-3">
        <p id={noticeId} className="text-xs">
          <Badge variant="warning" className="mr-1.5 border-current/20">
            Temporary
          </Badge>
          Staff login isn’t available yet, so choose your account here. This picker will be replaced
          by signing in.
        </p>
        <div className="flex w-full flex-col gap-3 text-foreground md:flex-row md:flex-wrap md:items-center md:gap-x-6">
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
          {!isLoading && !actor ? (
            <p className="text-xs text-muted-foreground">
              {staffAccounts.length
                ? 'Choose your staff account to see your site’s bins.'
                : 'No staff accounts exist yet.'}
            </p>
          ) : null}
          {actor && !siteName ? (
            <p className="text-xs text-muted-foreground">
              This staff account isn’t assigned to a site.
            </p>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  )
}
