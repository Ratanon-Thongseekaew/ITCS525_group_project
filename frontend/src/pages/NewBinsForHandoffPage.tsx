import { useCallback, useRef, useState, type MouseEvent } from 'react'
import { ArchiveRestore, Recycle } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getHandoffReadyBins, getHandoffs } from '@/api'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { actionButtonClass, BinDetail, cardClass, LoadState } from '@/components/staff/handoff-ui'
import { NewHandoffRecordDialog } from '@/components/staff/NewHandoffRecordDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatPackedAt } from '@/lib/handoff-format'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'
import type { HandoffReadyBin, HandoffRecord } from '@/types/handoff'

const sectionHeadingClass = 'text-sm font-medium text-slate-900'

interface SummaryMetricProps {
  label: string
  value: string
}

function SummaryMetric({ label, value }: SummaryMetricProps) {
  return (
    <Card className={cardClass}>
      <CardContent className="flex h-[132px] flex-col justify-between p-6">
        <dt className="text-sm text-slate-500">{label}</dt>
        <dd className="text-[26px] leading-[26px] font-medium tracking-[-1px] text-slate-900">
          {value}
        </dd>
      </CardContent>
    </Card>
  )
}

const recordsPath = '/staff/recycle-bin-handoff/handoff-records'

/** Disputed handoffs (weights more than 3% apart) waiting for a manager to approve them. */
function AwaitingApprovalMetric({ count }: { count: number | null }) {
  const hasDisputes = Boolean(count)

  return (
    <Card className={`${cardClass} ${hasDisputes ? 'border-rose-200 bg-rose-50' : ''}`}>
      <CardContent className="flex h-[132px] flex-col justify-between p-6">
        <dt className={`text-sm ${hasDisputes ? 'text-rose-800' : 'text-slate-500'}`}>
          Awaiting Approval
        </dt>
        <dd className="flex flex-wrap items-end justify-between gap-2">
          <span
            className={`text-[26px] leading-[26px] font-medium tracking-[-1px] ${hasDisputes ? 'text-rose-700' : 'text-slate-900'}`}
          >
            {count ?? '—'}
          </span>
          {hasDisputes ? (
            <Link
              to={recordsPath}
              className="text-xs font-medium text-rose-700 underline-offset-2 hover:underline"
            >
              Review in Handoff Records
            </Link>
          ) : null}
        </dd>
      </CardContent>
    </Card>
  )
}

function AwaitingHandoffBadge() {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-600">
      Awaiting Handoff
    </span>
  )
}

interface BinRecordCardProps {
  bin: HandoffReadyBin
  disabled: boolean
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void
}

function BinRecordCard({ bin, disabled, onSelect }: BinRecordCardProps) {
  return (
    <Card className={`relative transition-colors hover:bg-slate-50 ${cardClass}`}>
      <CardContent className="flex flex-col gap-4 p-6 xl:min-h-[144px] xl:flex-row xl:items-center xl:gap-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Recycle className="size-6 text-amber-600" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-lg leading-[21.6px] font-medium break-words text-slate-900">
              {/* Stretched over the card so the card stays clickable without nesting its details in a button. */}
              <button
                type="button"
                aria-haspopup="dialog"
                disabled={disabled}
                className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-2 focus-visible:after:ring-teal-600 disabled:cursor-not-allowed"
                onClick={onSelect}
              >
                #{bin.code}
              </button>
            </h3>
            <p className="text-sm font-medium text-amber-600">Recycling Bin · {bin.site_name}</p>
            {bin.ready_at ? (
              <p className="text-xs text-slate-500">Packed at {formatPackedAt(bin.ready_at)}</p>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:shrink-0 xl:gap-6">
          <BinDetail
            label="Item count"
            value={`${bin.item_count} items`}
            widthClass="xl:w-[120px]"
          />
          <BinDetail
            label="Grossed Weight"
            value={`${bin.total_weight_kg}kg`}
            widthClass="xl:w-[130px]"
          />
          <div className="flex flex-col items-start gap-2 xl:w-[176px]">
            <dt className="text-xs text-slate-500">Status</dt>
            <dd>
              <AwaitingHandoffBadge />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
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
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Operations</span>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-900" aria-current="page">
            Recycle Bin Handoff
          </span>
        </nav>

        <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-[26px] leading-[26px] font-medium tracking-[-1px] text-slate-900">
              New Bins for Handoff
            </h1>
            <p className="text-sm text-slate-500">
              Tap a bin when the contractor's driver arrives to record the handoff
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className={actionButtonClass}>
              <Link to={recordsPath}>
                <ArchiveRestore aria-hidden="true" />
                Handoff Records
              </Link>
            </Button>
          </div>
        </header>

        <HandoffActorBar workspace={workspace} />
      </div>

      <section className="flex flex-col gap-4 border-t border-slate-200 pt-4">
        <h2 className={sectionHeadingClass}>Summary</h2>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Bins Awaiting" value={String(bins.length)} />
          <SummaryMetric label="Items Staged" value={String(itemsStaged)} />
          {/* Rounded so summed decimal weights can't display floating-point noise. */}
          <SummaryMetric
            label="Total Grossed Weight"
            value={`${Number(totalWeight.toFixed(2))} kg`}
          />
          <AwaitingApprovalMetric count={resource.data ? awaitingApproval : null} />
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 ref={listHeadingRef} tabIndex={-1} className={`outline-none ${sectionHeadingClass}`}>
          Bins awaiting handoff
        </h2>
        {siteId === null && !workspace.isLoading ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Choose your staff account above to see the bins at your site.
          </p>
        ) : null}
        <LoadState
          isLoading={resource.isLoading || workspace.isLoading}
          error={resource.error}
          loadingLabel="Loading bins…"
          onRetry={resource.retry}
        />
        {resource.data ? (
          <>
            {bins.length > 0 ? (
              <ul className="flex flex-col gap-4">
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
              <p className="py-8 text-center text-sm text-slate-500">No bins awaiting handoff.</p>
            )}
            <p className="text-xs text-slate-500">
              Showing {bins.length} of {bins.length} records
            </p>
          </>
        ) : null}
      </section>

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
