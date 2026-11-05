import { Clock3, Recycle } from 'lucide-react'
import { BinDetail, cardClass } from '@/components/staff/handoff-ui'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  formatCollectedAt,
  formatRecordedWeight,
  formatVarianceKg,
  formatWeightKg,
} from '@/lib/handoff-format'
import { getOutcomeTotal, getOutcomeVariance } from '@/lib/handoff-records'
import {
  handoffRecordStatusLabels,
  type HandoffRecord,
  type HandoffRecordStatus,
  type MaterialOutcomes,
} from '@/types/handoff'

const statusBadgeClasses: Record<HandoffRecordStatus, string> = {
  collected: 'bg-slate-100 text-amber-600',
  outcomes_received: 'bg-teal-50 text-teal-700',
}

function HandoffRecordStatusBadge({ status }: { status: HandoffRecordStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${statusBadgeClasses[status]}`}
    >
      {handoffRecordStatusLabels[status]}
    </span>
  )
}

function PendingOutcomeNotice() {
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-slate-200 bg-slate-100 px-3 py-2">
      <Clock3 className="mt-0.5 size-4 shrink-0 text-slate-900" aria-hidden="true" />
      <p className="text-sm font-medium text-amber-600">Outcome report is still pending!</p>
    </div>
  )
}

interface OutcomeCellProps {
  label: string
  value: string
  highlight?: boolean
  className?: string
}

function OutcomeCell({ label, value, highlight = false, className = '' }: OutcomeCellProps) {
  return (
    <div className={`${highlight ? 'bg-teal-50' : ''} ${className}`}>
      <dt
        className={`flex min-h-12 items-center border-b border-slate-200 p-2 text-xs font-medium ${highlight ? 'text-teal-700' : 'text-slate-500'}`}
      >
        {label}
      </dt>
      <dd
        className={`flex min-h-11 items-center px-2 py-[7.5px] text-lg leading-[21.6px] font-medium whitespace-nowrap ${highlight ? 'text-teal-700' : 'text-slate-900'}`}
      >
        {value}
      </dd>
    </div>
  )
}

interface MaterialOutcomesSectionProps {
  outcomes: MaterialOutcomes
  recordedWeightKg: number
}

function MaterialOutcomesSection({ outcomes, recordedWeightKg }: MaterialOutcomesSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <Separator className="bg-slate-200" />
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4">
        <h4 className="text-sm font-medium text-slate-900">Material outcomes</h4>
        <p className="text-xs text-slate-500">WEIGHT / kg</p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-7">
        <OutcomeCell label="Upcycled" value={formatWeightKg(outcomes.upcycled_kg)} />
        <OutcomeCell
          label="Recycled to Fiber"
          value={formatWeightKg(outcomes.recycled_to_fiber_kg)}
        />
        <OutcomeCell label="Downcycled" value={formatWeightKg(outcomes.downcycled_kg)} />
        <OutcomeCell
          label="Exported Overseas"
          value={formatWeightKg(outcomes.exported_overseas_kg)}
        />
        <OutcomeCell label="Sent to landfill" value={formatWeightKg(outcomes.landfill_kg)} />
        {/* Starts a new row below xl so the two calculated cells stay together. */}
        <OutcomeCell
          label="Total Reported"
          value={formatWeightKg(getOutcomeTotal(outcomes))}
          highlight
          className="col-start-1 xl:col-start-auto"
        />
        <OutcomeCell
          label="Variance"
          value={formatVarianceKg(getOutcomeVariance(outcomes, recordedWeightKg))}
          highlight
        />
      </dl>
    </div>
  )
}

export function HandoffRecordCard({ record }: { record: HandoffRecord }) {
  return (
    <Card className={cardClass}>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-4 xl:min-h-[112px] xl:flex-row xl:items-center xl:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <Recycle className="size-6 text-amber-600" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h3 className="text-lg leading-[21.6px] font-medium break-words text-slate-900">
                #{record.bin_code}
              </h3>
              <p className="text-sm font-medium text-slate-900">{record.contractor.name}</p>
              <p className="text-xs text-slate-500">{formatCollectedAt(record.collected_at)}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:shrink-0 xl:gap-6">
            <BinDetail
              label="Item count"
              value={`${record.item_count} items`}
              widthClass="xl:w-[120px]"
            />
            <BinDetail
              label="Recorded Weight"
              value={formatRecordedWeight(record.recorded_weight_kg)}
              widthClass="xl:w-[130px]"
            />
            <div className="flex flex-col items-start gap-2 xl:w-[176px]">
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>
                <HandoffRecordStatusBadge status={record.status} />
              </dd>
            </div>
          </dl>
        </div>

        {record.outcomes ? (
          <MaterialOutcomesSection
            outcomes={record.outcomes}
            recordedWeightKg={record.recorded_weight_kg}
          />
        ) : (
          <PendingOutcomeNotice />
        )}
      </CardContent>
    </Card>
  )
}
