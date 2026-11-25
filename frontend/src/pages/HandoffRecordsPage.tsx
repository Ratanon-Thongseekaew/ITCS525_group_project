import { useCallback, useId, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getHandoffs } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { LoadState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { HandoffRecordCard } from '@/components/staff/HandoffRecordCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getVisibleRecords } from '@/lib/handoff-records'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'
import {
  handoffRecordFilterLabels,
  handoffRecordSortLabels,
  type HandoffRecordFilter,
  type HandoffRecordSort,
} from '@/types/handoff'

interface RecordsControlProps<Value extends string> {
  label: string
  value: Value
  options: Record<Value, string>
  minWidthClass: string
  onChange: (value: Value) => void
}

function RecordsControl<Value extends string>({
  label,
  value,
  options,
  minWidthClass,
  onChange,
}: RecordsControlProps<Value>) {
  const id = useId()

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="font-normal whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as Value)}>
        {/* Grows with its value so longer options like "Outcomes Received" don't clip. */}
        <SelectTrigger id={id} className={`w-auto font-medium whitespace-nowrap ${minWidthClass}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries<string>(options).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

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
            <RecordsControl
              label="Filtered by:"
              value={filter}
              options={handoffRecordFilterLabels}
              minWidthClass="min-w-[96px]"
              onChange={setFilter}
            />
            <RecordsControl
              label="Sort by:"
              value={sort}
              options={handoffRecordSortLabels}
              minWidthClass="min-w-[112px]"
              onChange={setSort}
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
