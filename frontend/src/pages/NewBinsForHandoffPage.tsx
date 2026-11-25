import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { ArchiveRestore, Recycle } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getHandoffReadyBins, getHandoffs } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { LoadState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { RecordCard, RecordDetail } from '@/components/RecordCard'
import { StatCard } from '@/components/StatCard'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { NewHandoffRecordDialog } from '@/components/staff/NewHandoffRecordDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { formatPackedAt } from '@/lib/handoff-format'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'
import type { HandoffReadyBin, HandoffRecord } from '@/types/handoff'

const recordsPath = '/staff/recycle-bin-handoff/handoff-records'

/** Disputed handoffs (weights more than 3% apart) waiting for a manager to approve them. */
function AwaitingApprovalMetric({ count }: { count: number | null }) {
  const hasDisputes = Boolean(count)

  return (
    <StatCard
      label="Awaiting Approval"
      value={count ?? '—'}
      tone={hasDisputes ? 'destructive' : 'default'}
      footer={
        hasDisputes ? (
          <Link
            to={recordsPath}
            className="text-xs font-medium text-destructive underline-offset-2 hover:underline"
          >
            Review in Handoff Records
          </Link>
        ) : null
      }
    />
  )
}

interface BinRecordCardProps {
  bin: HandoffReadyBin
  disabled: boolean
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void
}

function BinRecordCard({ bin, disabled, onSelect }: BinRecordCardProps) {
  return (
    <RecordCard
      icon={<Recycle strokeWidth={1.8} />}
      iconClassName={BIN_TYPE_TONES.recycle.soft}
      title={`#${bin.code}`}
      subtitle={
        <span className="text-recycle-soft-foreground">Recycling Bin · {bin.site_name}</span>
      }
      meta={bin.ready_at ? `Packed at ${formatPackedAt(bin.ready_at)}` : undefined}
      onSelect={onSelect}
      selectDisabled={disabled}
      selectProps={{ 'aria-haspopup': 'dialog' }}
      details={
        <>
          <RecordDetail label="Item count" className="xl:w-[120px]">
            {bin.item_count} items
          </RecordDetail>
          <RecordDetail label="Grossed Weight" className="xl:w-[130px]">
            {bin.total_weight_kg}kg
          </RecordDetail>
        </>
      }
      status={<Badge variant="recycle">Awaiting Handoff</Badge>}
    />
  )
}

export function NewBinsForHandoffPage() {
  const workspace = useHandoffWorkspace()
  const { options, siteId, actor } = workspace
  const loadBins = useCallback(
    async (signal: AbortSignal) => {
      const site = siteId ?? undefined
      const [binsResponse, disputedResponse] = await Promise.all([
        getHandoffReadyBins(site, signal),
        getHandoffs({ status: 'disputed', site_id: site }, signal),
      ])
      return { bins: binsResponse.bins, awaitingApproval: disputedResponse.handoffs.length }
    },
    [siteId],
  )
  // Staff only see their own site, so nothing loads until a staff account is chosen.
  const resource = useApiResource(
    siteId === null ? null : `ready-bins:${siteId}`,
    loadBins,
    'Bins awaiting handoff could not be loaded.',
  )
  const [selectedBin, setSelectedBin] = useState<HandoffReadyBin | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const bins = resource.data?.bins ?? []
  const awaitingApproval = resource.data?.awaitingApproval ?? 0
  const itemsStaged = bins.reduce((sum, bin) => sum + bin.item_count, 0)
  const totalWeight = bins.reduce((sum, bin) => sum + bin.total_weight_kg, 0)

  function handleRecorded(record: HandoffRecord) {
    // The clicked card is removed, so focus moves to the list heading instead.
    returnFocusRef.current = listHeadingRef.current
    resource.update((data) => ({
      bins: data.bins.filter((bin) => bin.id !== record.bin_id),
      awaitingApproval: data.awaitingApproval + (record.status === 'disputed' ? 1 : 0),
    }))
    setSelectedBin(null)
    if (record.status === 'disputed') {
      toast.warning('Handoff recorded as Disputed', {
        description: `#${record.bin_code}: the weights differ by ${record.weight_variance_percent}%. A manager must approve it.`,
      })
    } else {
      toast.success('Handoff recorded', { description: `#${record.bin_code} was picked up.` })
    }
  }

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={[{ label: 'Operations' }, { label: 'Recycle Bin Handoff' }]}
          title="New Bins for Handoff"
          description="Tap a bin when the contractor's driver arrives to record the handoff"
          actions={
            <Button asChild variant="outline">
              <Link to={recordsPath}>
                <ArchiveRestore aria-hidden="true" />
                Handoff Records
              </Link>
            </Button>
          }
        />
        <HandoffActorBar workspace={workspace} />
      </div>

      <PageSection title="Summary" bordered>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Bins Awaiting" value={String(bins.length)} />
          <StatCard label="Items Staged" value={String(itemsStaged)} />
          {/* Rounded so summed decimal weights can't display floating-point noise. */}
          <StatCard label="Total Grossed Weight" value={`${Number(totalWeight.toFixed(2))} kg`} />
          <AwaitingApprovalMetric count={resource.data ? awaitingApproval : null} />
        </dl>
      </PageSection>

      <PageSection
        title="Bins awaiting handoff"
        headingRef={listHeadingRef}
        footer={resource.data ? `Showing ${bins.length} of ${bins.length} records` : undefined}
      >
        {siteId === null && !workspace.isLoading ? (
          <EmptyState>Choose your staff account above to see the bins at your site.</EmptyState>
        ) : null}
        <LoadState
          isLoading={resource.isLoading || workspace.isLoading}
          error={resource.error}
          loadingLabel="Loading bins…"
          onRetry={resource.retry}
        />
        {resource.data ? (
          bins.length > 0 ? (
            <ul aria-label="Bins awaiting handoff" className="flex flex-col gap-4">
              {bins.map((bin) => (
                <li key={bin.id}>
                  <BinRecordCard
                    bin={bin}
                    disabled={!actor}
                    onSelect={(event) => {
                      returnFocusRef.current = event.currentTarget
                      setSelectedBin(bin)
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No bins awaiting handoff.</EmptyState>
          )
        ) : null}
      </PageSection>

      {selectedBin && actor && options ? (
        <NewHandoffRecordDialog
          bin={selectedBin}
          contractors={options.contractors}
          actorId={actor.id}
          onClose={() => setSelectedBin(null)}
          onRecorded={handleRecorded}
          onCloseAutoFocus={(event) => {
            // Radix only restores focus to its own DialogTrigger, which this dialog doesn't use.
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
        />
      ) : null}
    </section>
  )
}
