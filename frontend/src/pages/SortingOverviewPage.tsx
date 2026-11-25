import { useCallback, useMemo, useState } from 'react'
import { MapPin, UserRound } from 'lucide-react'

import {
  getBins,
  getHandoffOptions,
  getRecentGarments,
  getSortingStats,
  type BinRecord,
  type GarmentItem,
  type HandoffActorOption,
  type SortingStatsResponse,
} from '@/api'
import { ErrorState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { TableCard } from '@/components/TableCard'
import { TemporaryAccountPicker } from '@/components/TemporaryAccountPicker'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BIN_STATUS_BADGE_VARIANTS, BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { BIN_STATUS_LABELS, BIN_TYPE_LABELS, CONDITION_LABELS } from '@/lib/sorting-labels'
import { useApiResource } from '@/lib/use-api-resource'

// Until managers sign in, the page asks which manager (or administrator) is looking. The choice
// is remembered per browser; storage can be unavailable, so it is optional.
const ACTOR_KEY = 'textile-track:sorting-overview-actor-id'
const ALL_SITES = 'all'

function readStoredActorId() {
  try {
    const value = Number(window.localStorage.getItem(ACTOR_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function storeActorId(value: number) {
  try {
    window.localStorage.setItem(ACTOR_KEY, String(value))
  } catch {
    // Ignore: the picker still works for this page view.
  }
}

interface Overview {
  stats: SortingStatsResponse
  bins: BinRecord[]
  garments: GarmentItem[]
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** A manager's read-only view of garment intake and bins, for one site or all of theirs. */
export function SortingOverviewPage() {
  const options = useApiResource(
    'handoff-options',
    getHandoffOptions,
    'Accounts could not be loaded.',
  )
  const [storedActorId, setStoredActorId] = useState(readStoredActorId)
  const [siteChoice, setSiteChoice] = useState(ALL_SITES)

  const managers = useMemo(
    () => options.data?.actors.filter((actor) => actor.role !== 'staff') ?? [],
    [options.data],
  )
  const actor: HandoffActorOption | null =
    managers.find((candidate) => candidate.id === storedActorId) ?? null

  // A manager with sites sees those; a manager with none, and an administrator, see them all.
  const sites = useMemo(() => {
    const allSites = options.data?.sites ?? []
    if (actor?.role === 'manager' && actor.site_ids.length > 0) {
      return allSites.filter((site) => actor.site_ids.includes(site.id))
    }
    return allSites
  }, [actor, options.data])
  const siteId = sites.some((site) => String(site.id) === siteChoice)
    ? Number(siteChoice)
    : undefined

  const chooseActor = useCallback((value: string) => {
    setStoredActorId(Number(value))
    storeActorId(Number(value))
    setSiteChoice(ALL_SITES)
  }, [])

  const actorId = actor?.id ?? null
  const overview = useApiResource<Overview>(
    actorId === null ? null : `sorting-overview:${actorId}:${siteId ?? ALL_SITES}`,
    async () => {
      const [stats, bins, garments] = await Promise.all([
        getSortingStats(actorId!, siteId),
        getBins(actorId!, siteId),
        getRecentGarments(actorId!, siteId, 20),
      ])
      return { stats, bins, garments }
    },
    'The sorting overview could not be loaded.',
  )
  const error = options.error ?? overview.error
  const data = overview.data

  let pickerMessage: string | null = null
  if (!options.isLoading && !actor && !options.error) {
    pickerMessage = managers.length
      ? 'Choose your manager account to see sorting data.'
      : 'No manager accounts exist yet.'
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Store Operations • Read only"
        title="Sorting Overview"
        description="Garment intake and bins for one site, or all of your sites together."
      />

      <TemporaryAccountPicker
        role="Manager"
        noticeId="overview-actor-notice"
        message={pickerMessage}
      >
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Label
            htmlFor="overview-actor"
            className="flex items-center gap-1.5 font-normal text-muted-foreground"
          >
            <UserRound className="size-4" aria-hidden="true" />
            Manager
          </Label>
          <Select
            value={actor ? String(actor.id) : ''}
            onValueChange={chooseActor}
            disabled={options.isLoading || managers.length === 0}
          >
            <SelectTrigger
              id="overview-actor"
              aria-describedby="overview-actor-notice"
              className="bg-background sm:w-auto sm:min-w-[240px]"
            >
              <SelectValue placeholder={options.isLoading ? 'Loading…' : 'Choose your account'} />
            </SelectTrigger>
            <SelectContent>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={String(manager.id)}>
                  {manager.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Label
            htmlFor="overview-site"
            className="flex items-center gap-1.5 font-normal text-muted-foreground"
          >
            <MapPin className="size-4" aria-hidden="true" />
            Site
          </Label>
          <Select value={siteChoice} onValueChange={setSiteChoice} disabled={actor === null}>
            <SelectTrigger id="overview-site" className="bg-background sm:w-auto sm:min-w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SITES}>All sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={String(site.id)}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </TemporaryAccountPicker>

      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Sorted today" value={data.stats.total_sorted_today} />
            <StatCard label="Resale" value={data.stats.resale_count} tone="resale" />
            <StatCard label="Recycle" value={data.stats.recycle_count} tone="recycle" />
            <StatCard label="Repair / Upcycle" value={data.stats.repair_count} tone="repair" />
          </dl>

          <TableCard title="Bins">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">Site</TableHead>
                  <TableHead className="px-4">Bin Code</TableHead>
                  <TableHead className="px-4">Type</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                  <TableHead className="px-4">Items</TableHead>
                  <TableHead className="px-4">Weight (kg)</TableHead>
                  <TableHead className="px-4">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                      No bins found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.bins.map((bin) => (
                    <TableRow key={bin.id}>
                      <TableCell className="px-4">{bin.site_name}</TableCell>
                      <TableCell className="px-4 font-semibold">{bin.bin_code}</TableCell>
                      <TableCell className="px-4">
                        <Badge variant={BIN_TYPE_TONES[bin.bin_type].variant}>
                          {BIN_TYPE_LABELS[bin.bin_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge variant={BIN_STATUS_BADGE_VARIANTS[bin.status]}>
                          {BIN_STATUS_LABELS[bin.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4">
                        {bin.item_count} / {bin.max_capacity}
                      </TableCell>
                      <TableCell className="px-4">{bin.total_weight_kg}</TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {formatDateTime(bin.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableCard>

          <TableCard title="Recent garments">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">Site</TableHead>
                  <TableHead className="px-4">Received</TableHead>
                  <TableHead className="px-4">Category</TableHead>
                  <TableHead className="px-4">Condition</TableHead>
                  <TableHead className="px-4">Bin</TableHead>
                  <TableHead className="px-4">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.garments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No garments sorted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.garments.map((garment) => (
                    <TableRow key={garment.id}>
                      <TableCell className="px-4">{garment.site_name}</TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {formatDateTime(garment.created_at)}
                      </TableCell>
                      <TableCell className="px-4 font-semibold">{garment.category}</TableCell>
                      <TableCell className="px-4">{CONDITION_LABELS[garment.condition]}</TableCell>
                      <TableCell className="px-4 font-mono">{garment.bin_code}</TableCell>
                      <TableCell className="px-4">{garment.weight_kg ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableCard>
        </>
      ) : null}
    </div>
  )
}
