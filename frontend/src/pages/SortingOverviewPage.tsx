import { useCallback, useMemo, useState } from 'react'
import { Info, MapPin, UserRound } from 'lucide-react'

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useApiResource } from '@/lib/use-api-resource'
import {
  BIN_STATUS_LABELS,
  BIN_TYPE_LABELS,
  BIN_TYPE_STYLES,
  CONDITION_LABELS,
} from '@/lib/sorting-labels'

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

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
          Store Operations • Read only
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Sorting Overview</h1>
        <p className="text-sm text-slate-500">
          Garment intake and bins for one site, or all of your sites together.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-dashed border-amber-300 bg-amber-50/40 px-4 py-3">
        <p className="flex items-start gap-2 text-xs text-amber-800">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="mr-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-px font-medium">
              Temporary
            </span>
            Manager login isn’t available yet, so choose your account here. This picker will be
            replaced by signing in.
          </span>
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-x-6">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            <Label
              htmlFor="overview-actor"
              className="flex items-center gap-1.5 text-sm font-normal text-slate-500"
            >
              <UserRound className="size-4" aria-hidden="true" />
              Manager
            </Label>
            <Select
              value={actor ? String(actor.id) : ''}
              onValueChange={chooseActor}
              disabled={options.isLoading || managers.length === 0}
            >
              <SelectTrigger id="overview-actor" className="h-9 w-full min-w-[240px] sm:w-auto">
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
              className="flex items-center gap-1.5 text-sm font-normal text-slate-500"
            >
              <MapPin className="size-4" aria-hidden="true" />
              Site
            </Label>
            <Select value={siteChoice} onValueChange={setSiteChoice} disabled={actor === null}>
              <SelectTrigger id="overview-site" className="h-9 w-full min-w-[200px] sm:w-auto">
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
        </div>
        {!options.isLoading && !actor && !options.error ? (
          <p className="text-xs text-amber-700">
            {managers.length
              ? 'Choose your manager account to see sorting data.'
              : 'No manager accounts exist yet.'}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['Sorted today', data.stats.total_sorted_today],
              ['Resale', data.stats.resale_count],
              ['Recycle', data.stats.recycle_count],
              ['Repair / Upcycle', data.stats.repair_count],
            ].map(([label, value]) => (
              <Card key={label} className="border-slate-200">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-medium">{label}</CardDescription>
                  <CardTitle className="text-2xl font-bold text-slate-900">{value}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold text-slate-900">Bins</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="px-4 py-2.5">Site</th>
                      <th className="px-4 py-2.5">Bin Code</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Items</th>
                      <th className="px-4 py-2.5">Weight (kg)</th>
                      <th className="px-4 py-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.bins.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No bins found.
                        </td>
                      </tr>
                    ) : (
                      data.bins.map((bin) => (
                        <tr key={bin.id}>
                          <td className="px-4 py-2.5 text-slate-700">{bin.site_name}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            {bin.bin_code}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${BIN_TYPE_STYLES[bin.bin_type]}`}
                            >
                              {BIN_TYPE_LABELS[bin.bin_type]}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{BIN_STATUS_LABELS[bin.status]}</td>
                          <td className="px-4 py-2.5">
                            {bin.item_count} / {bin.max_capacity}
                          </td>
                          <td className="px-4 py-2.5">{bin.total_weight_kg}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {formatDateTime(bin.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-lg font-bold text-slate-900">Recent garments</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-y border-slate-200 bg-slate-50 font-semibold text-slate-600">
                      <th className="px-4 py-2.5">Site</th>
                      <th className="px-4 py-2.5">Received</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Condition</th>
                      <th className="px-4 py-2.5">Bin</th>
                      <th className="px-4 py-2.5">Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.garments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No garments sorted yet.
                        </td>
                      </tr>
                    ) : (
                      data.garments.map((garment) => (
                        <tr key={garment.id}>
                          <td className="px-4 py-2.5 text-slate-700">{garment.site_name}</td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {formatDateTime(garment.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">
                            {garment.category}
                          </td>
                          <td className="px-4 py-2.5">{CONDITION_LABELS[garment.condition]}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px]">{garment.bin_code}</td>
                          <td className="px-4 py-2.5">{garment.weight_kg ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
