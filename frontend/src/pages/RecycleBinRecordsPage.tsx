import { useCallback, useState } from 'react'
import { MapPin, UserRound } from 'lucide-react'
import { getHandoffs, getSortingSites, type HandoffListResponse } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { FilterSelect, type FilterOption } from '@/components/FilterSelect'
import { LoadState } from '@/components/LoadState'
import { HandoffReviewActions } from '@/components/manager/HandoffReviewActions'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { HandoffRecordCard } from '@/components/staff/HandoffRecordCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSession } from '@/lib/auth-session'
import { getVisibleReviewRecords } from '@/lib/handoff-records'
import { useApiResource } from '@/lib/use-api-resource'
import {
  handoffRecordSortLabels,
  handoffReviewFilterLabels,
  type HandoffRecord,
  type HandoffRecordSort,
  type HandoffReviewFilter,
} from '@/types/handoff'

const ALL_SITES = 'all'

function toOptions(labels: Record<string, string>): FilterOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

const filterOptions = toOptions(handoffReviewFilterLabels)
const sortOptions = toOptions(handoffRecordSortLabels)

/**
 * The manager's review of recycle bin handoffs: check weights, evidence, and reported outcomes,
 * approve Disputed handoffs, and close handoffs whose outcome report is in.
 */
export function RecycleBinRecordsPage() {
  const session = useSession()
  const user = session?.user ?? null
  const token = session?.token ?? ''
  // Staff record handoffs from their own screen; reviewing them is for managers and administrators.
  const viewer = user && user.role !== 'staff' ? user : null
  const viewerId = viewer?.id ?? null
  const [siteChoice, setSiteChoice] = useState(ALL_SITES)
  const [filter, setFilter] = useState<HandoffReviewFilter>('all')
  const [sort, setSort] = useState<HandoffRecordSort>('date')

  const sitesResource = useApiResource(
    viewerId === null ? null : `handoff-review-sites:${viewerId}`,
    () => getSortingSites(token),
    'Your sites could not be loaded.',
  )
  const sites = sitesResource.data
  const loadRecords = useCallback(
    async (signal: AbortSignal): Promise<HandoffListResponse> => {
      const siteIds = new Set((sites ?? []).map((site) => site.id))
      const siteId = siteChoice === ALL_SITES ? undefined : Number(siteChoice)
      const response = await getHandoffs(token, { site_id: siteId }, signal)
      // Managers only review the sites they run.
      return { handoffs: response.handoffs.filter((record) => siteIds.has(record.site_id)) }
    },
    [sites, siteChoice, token],
  )
  const resource = useApiResource(
    viewerId === null || sites === null ? null : `handoff-review:${viewerId}:${siteChoice}`,
    loadRecords,
    'Handoff records could not be loaded.',
  )
  const records = resource.data?.handoffs ?? []
  const visibleRecords = getVisibleReviewRecords(records, filter, sort)
  const siteOptions: FilterOption[] = [
    { value: ALL_SITES, label: 'All sites' },
    ...(sites ?? []).map((site) => ({ value: String(site.id), label: site.name })),
  ]

  const updateRecords = resource.update
  const replaceRecord = useCallback(
    (updated: HandoffRecord) =>
      updateRecords((data) => ({
        handoffs: data.handoffs.map((record) => (record.id === updated.id ? updated : record)),
      })),
    [updateRecords],
  )

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Recycle Bin Handoff' }]}
        title="Recycle Bin Records"
        description="Approve disputed handoffs and close them once outcomes are reported."
      />

      {viewer ? null : (
        <Alert variant="warning">
          <UserRound aria-hidden="true" />
          <AlertDescription>
            Recycle Bin Records is available to manager and administrator accounts only.
          </AlertDescription>
        </Alert>
      )}

      {viewer ? (
        <PageSection
          title="Handoff records"
          bordered
          actions={
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {/* A manager of a single site only sees that site, so it is shown rather than picked. */}
              {sites && sites.length > 1 ? (
                <FilterSelect
                  label="Site:"
                  labelMode="inline"
                  value={siteChoice}
                  items={siteOptions}
                  onValueChange={setSiteChoice}
                  className="min-w-[120px]"
                />
              ) : sites?.length === 1 ? (
                <p className="flex h-9 min-w-0 items-center gap-1.5 text-sm">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="text-muted-foreground">Site:</span>
                  <span className="truncate font-medium">{sites[0].name}</span>
                </p>
              ) : null}
              <FilterSelect
                label="Filtered by:"
                labelMode="inline"
                value={filter}
                items={filterOptions}
                onValueChange={(value) => setFilter(value as HandoffReviewFilter)}
                className="min-w-[96px]"
              />
              <FilterSelect
                label="Sort by:"
                labelMode="inline"
                value={sort}
                items={sortOptions}
                onValueChange={(value) => setSort(value as HandoffRecordSort)}
                className="min-w-[112px]"
              />
            </div>
          }
          footer={
            resource.data ? (
              <p aria-live="polite">
                Showing {visibleRecords.length} of {records.length} records
              </p>
            ) : undefined
          }
        >
          <LoadState
            isLoading={sitesResource.isLoading || resource.isLoading}
            error={sitesResource.error ?? resource.error}
            loadingLabel="Loading handoff records…"
            onRetry={sitesResource.error ? sitesResource.retry : resource.retry}
          />
          {resource.data ? (
            visibleRecords.length > 0 ? (
              <ul aria-label="Handoff records" className="flex flex-col gap-4">
                {visibleRecords.map((record) => (
                  <li key={record.id}>
                    <HandoffRecordCard
                      record={record}
                      actions={<HandoffReviewActions record={record} onUpdated={replaceRecord} />}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>
                {filter === 'all'
                  ? 'No handoff records yet.'
                  : 'No handoff records match this filter.'}
              </EmptyState>
            )
          ) : null}
        </PageSection>
      ) : null}
    </section>
  )
}
