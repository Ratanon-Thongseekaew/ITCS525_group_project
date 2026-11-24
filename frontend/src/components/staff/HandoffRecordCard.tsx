import { Clock3, ExternalLink, Recycle, TriangleAlert } from 'lucide-react'
import { handoffPhotoUrl } from '@/api'
import { BinDetail, cardClass } from '@/components/staff/handoff-ui'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  formatCollectedAt,
  formatRecordedWeight,
  formatVarianceKg,
  formatVariancePercent,
  formatWeightDifference,
  formatWeightKg,
} from '@/lib/handoff-format'
import {
  getDisplayStatus,
  getOutcomeTotal,
  getOutcomeVariance,
  getRecordedWeight,
  getWeightDifferenceKg,
} from '@/lib/handoff-records'
import {
  handoffOutcomeLabels,
  handoffRecordStatusLabels,
  type HandoffOutcomes,
  type HandoffRecord,
  type HandoffRecordStatus,
} from '@/types/handoff'

const statusBadgeClasses: Record<HandoffRecordStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-700',
  picked_up: 'bg-slate-100 text-amber-600',
  disputed: 'bg-rose-50 text-rose-700',
  approved: 'bg-teal-50 text-teal-700',
  closed: 'bg-teal-50 text-teal-700',
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
  outcomes: HandoffOutcomes
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
      <dl className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
        {(Object.keys(handoffOutcomeLabels) as (keyof HandoffOutcomes)[]).map((key) => (
          <OutcomeCell
            key={key}
            label={handoffOutcomeLabels[key]}
            value={formatWeightKg(outcomes[key])}
          />
        ))}
        <OutcomeCell
          label="Total Reported"
          value={formatWeightKg(getOutcomeTotal(outcomes))}
          highlight
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

function PickupEvidence({ record }: { record: HandoffRecord }) {
  const photoUrl = handoffPhotoUrl(record.scale_photo_url)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      {record.driver_name ? (
        <span>
          Driver: <span className="font-medium text-slate-900">{record.driver_name}</span>
          {record.vehicle_plate_number ? ` · ${record.vehicle_plate_number}` : ''}
        </span>
      ) : null}
      {photoUrl ? (
        <a
          href={photoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-teal-700 underline-offset-2 hover:underline"
        >
          View scale photo
          <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : null}
      {record.approved_by ? <span>Approved by {record.approved_by}</span> : null}
      <span>Recorded by {record.created_by}</span>
    </div>
  )
}

export function HandoffRecordCard({ record }: { record: HandoffRecord }) {
  const recordedAt = record.picked_up_at ?? record.scheduled_pickup_at
  const isPickedUp = record.picked_up_at !== null

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
              <p className="text-sm font-medium text-slate-900">
                {record.contractor_name}{' '}
                <span className="font-normal text-slate-500">· {record.site_name}</span>
              </p>
              {recordedAt ? (
                <p className="text-xs text-slate-500">
                  {isPickedUp ? '' : 'Scheduled for '}
                  {formatCollectedAt(recordedAt)}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:flex xl:shrink-0 xl:gap-6">
            <BinDetail
              label="Item count"
              value={`${record.item_count} items`}
              widthClass="xl:w-[100px]"
            />
            <BinDetail
              label={isPickedUp ? 'Staff Weight' : 'Bin Weight'}
              value={formatRecordedWeight(getRecordedWeight(record))}
              widthClass="xl:w-[110px]"
            />
            {isPickedUp && record.driver_weight_kg !== null ? (
              <BinDetail
                label="Driver Weight"
                value={formatRecordedWeight(record.driver_weight_kg)}
                widthClass="xl:w-[110px]"
              />
            ) : null}
            {record.weight_variance_percent !== null ? (
              <BinDetail
                label="Difference"
                value={
                  record.staff_weight_kg !== null && record.driver_weight_kg !== null
                    ? formatWeightDifference(
                        getWeightDifferenceKg(record.staff_weight_kg, record.driver_weight_kg),
                        record.weight_variance_percent,
                      )
                    : formatVariancePercent(record.weight_variance_percent)
                }
                widthClass="xl:w-[140px]"
              />
            ) : null}
            <div className="flex flex-col items-start gap-2 xl:w-[120px]">
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>
                <HandoffRecordStatusBadge status={getDisplayStatus(record)} />
              </dd>
            </div>
          </dl>
        </div>

        {isPickedUp ? <PickupEvidence record={record} /> : null}

        {record.status === 'disputed' ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-700" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm font-medium text-rose-800">
              The staff and driver weights differ by more than 3%. This handoff is waiting for
              manager approval before it can be closed.
            </p>
          </div>
        ) : null}

        {!isPickedUp ? null : record.outcomes ? (
          <MaterialOutcomesSection
            outcomes={record.outcomes}
            recordedWeightKg={getRecordedWeight(record)}
          />
        ) : (
          <PendingOutcomeNotice />
        )}
      </CardContent>
    </Card>
  )
}
