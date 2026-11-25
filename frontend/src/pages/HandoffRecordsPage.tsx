import { useCallback, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getHandoffs } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { FilterSelect, type FilterOption } from '@/components/FilterSelect'
import { LoadState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { HandoffRecordCard } from '@/components/staff/HandoffRecordCard'
import { Button } from '@/components/ui/button'
import { getVisibleRecords } from '@/lib/handoff-records'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'
import {
  handoffRecordFilterLabels,
  handoffRecordSortLabels,
  type HandoffRecordFilter,
  type HandoffRecordSort,
} from '@/types/handoff'

function toOptions(labels: Record<string, string>): FilterOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

const filterOptions = toOptions(handoffRecordFilterLabels)
const sortOptions = toOptions(handoffRecordSortLabels)

export function HandoffRecordsPage() {
  const workspace = useHandoffWorkspace()
  const { siteId } = workspace
  const [filter, setFilter] = useState<HandoffRecordFilter>('all')
  const [sort, setSort] = useState<HandoffRecordSort>('date')
  const loadRecords = useCallback(
    (signal: AbortSignal) => getHandoffs({ site_id: siteId ?? undefined }, signal),
    [siteId],
  )
  // Staff only see their own site, so nothing loads until a staff account is chosen.
  const resource = useApiResource(
    siteId === null ? null : `handoff-records:${siteId}`,
    loadRecords,
    'Handoff records could not be loaded.',
  )
  const records = resource.data?.handoffs ?? []
  const visibleRecords = getVisibleRecords(records, filter, sort)

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={[
            { label: 'Operations' },
            { label: 'Recycle Bin Handoff', to: '/staff/recycle-bin-handoff' },
            { label: 'Records' },
          ]}
          title="Handoff Records"
          description="Review contractor collections, recorded weights, and material outcomes."
          actions={
            <Button asChild variant="outline">
              <Link to="/staff/recycle-bin-handoff">
                <ArrowLeft aria-hidden="true" />
                Back to Handoff
              </Link>
            </Button>
          }
        />
        <HandoffActorBar workspace={workspace} />
      </div>

      <PageSection
        title="Handoff records"
        bordered
        actions={
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <FilterSelect
              label="Filtered by:"
              labelMode="inline"
              value={filter}
              items={filterOptions}
              onValueChange={(value) => setFilter(value as HandoffRecordFilter)}
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
        {siteId === null && !workspace.isLoading ? (
          <EmptyState>
            Choose your staff account above to see your site’s handoff records.
          </EmptyState>
        ) : null}
        <LoadState
          isLoading={resource.isLoading || workspace.isLoading}
          error={resource.error}
          loadingLabel="Loading handoff records…"
          onRetry={resource.retry}
        />
        {resource.data ? (
          visibleRecords.length > 0 ? (
            <ul aria-label="Handoff records" className="flex flex-col gap-4">
              {visibleRecords.map((record) => (
                <li key={record.id}>
                  <HandoffRecordCard record={record} />
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
    </section>
  )
}
