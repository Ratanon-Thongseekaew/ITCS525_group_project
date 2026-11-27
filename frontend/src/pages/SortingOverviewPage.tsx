import { useState } from 'react'
import { MapPin, UserRound } from 'lucide-react'

import {
  getBins,
  getRecentGarments,
  getSortingSites,
  getSortingStats,
  type BinRecord,
  type GarmentItem,
  type SortingStatsResponse,
} from '@/api'
import { ErrorState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { TableCard } from '@/components/TableCard'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from '@/lib/auth-session'
import { BIN_STATUS_BADGE_VARIANTS, BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { BIN_STATUS_LABELS, BIN_TYPE_LABELS, CONDITION_LABELS } from '@/lib/sorting-labels'
import { useApiResource } from '@/lib/use-api-resource'

const ALL_SITES = 'all'

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
  const user = useSession()?.user ?? null
  // Staff sort from their own screen; this overview is for managers and administrators.
  const viewer = user && user.role !== 'staff' ? user : null
  const viewerId = viewer?.id ?? null
  const [siteChoice, setSiteChoice] = useState(ALL_SITES)

  const sitesResource = useApiResource(
    viewerId === null ? null : `sorting-sites:${viewerId}`,
    () => getSortingSites(viewerId!),
    'Your sites could not be loaded.',
  )
  const sites = sitesResource.data ?? []
  const siteId = sites.some((site) => String(site.id) === siteChoice)
    ? Number(siteChoice)
    : undefined

  const overview = useApiResource<Overview>(
    viewerId === null ? null : `sorting-overview:${viewerId}:${siteId ?? ALL_SITES}`,
    async () => {
      const [stats, bins, garments] = await Promise.all([
        getSortingStats(viewerId!, siteId),
        getBins(viewerId!, siteId),
        getRecentGarments(viewerId!, siteId, 20),
      ])
      return { stats, bins, garments }
    },
    'The sorting overview could not be loaded.',
  )
  const error = sitesResource.error ?? overview.error
  const data = overview.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Store Operations • Read only"
        title="Sorting Overview"
        description="Garment intake and bins for one site, or all of your sites together."
      />

      {viewer ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
          role="group"
          aria-label="Signed-in account and site"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs text-muted-foreground">Signed in as</span>
              <span className="truncate text-sm font-medium">
                {viewer.full_name || viewer.username}
              </span>
            </div>
          </div>
          {/* A manager of a single site only sees that site, so it is shown rather than picked. */}
          {sites.length === 1 ? (
            <p className="flex min-w-0 items-center gap-1.5 text-sm">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">Site</span>
              <span className="truncate font-medium">{sites[0].name}</span>
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
              <Label
                htmlFor="overview-site"
                className="flex items-center gap-1.5 font-normal text-muted-foreground"
              >
                <MapPin className="size-4" aria-hidden="true" />
                Site
              </Label>
              <Select value={siteChoice} onValueChange={setSiteChoice}>
                <SelectTrigger
                  id="overview-site"
                  className="bg-background sm:w-auto sm:min-w-[200px]"
                >
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
          )}
        </div>
      ) : (
        <Alert variant="warning">
          <UserRound aria-hidden="true" />
          <AlertDescription>
            Sorting Overview is available to manager and administrator accounts only.
          </AlertDescription>
        </Alert>
      )}

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
