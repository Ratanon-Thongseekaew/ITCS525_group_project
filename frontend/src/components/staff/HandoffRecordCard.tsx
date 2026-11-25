import { Clock3, ExternalLink, Recycle, TriangleAlert } from 'lucide-react'
import { handoffPhotoUrl } from '@/api'
import { RecordCard, RecordDetail } from '@/components/RecordCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
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
  HANDOFF_STATUS_BADGE_VARIANTS,
} from '@/lib/handoff-records'
import { cn } from '@/lib/utils'
import {
  handoffOutcomeLabels,
  handoffRecordStatusLabels,
  type HandoffOutcomes,
  type HandoffRecord,
} from '@/types/handoff'

function PendingOutcomeNotice() {
  return (
    <Alert variant="warning" role="note">
      <Clock3 aria-hidden="true" />
      <AlertTitle>Outcome report is still pending!</AlertTitle>
    </Alert>
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
    <div className={cn(highlight && 'bg-primary/10', className)}>
      <dt
        className={cn(
          'flex min-h-12 items-center border-b p-2 text-xs font-medium',
          highlight ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          'flex min-h-11 items-center px-2 py-2 text-base font-medium whitespace-nowrap',
          highlight ? 'text-primary' : 'text-foreground',
        )}
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
      <Separator />
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4">
        <h4 className="text-sm font-medium text-foreground">Material outcomes</h4>
        <p className="text-xs text-muted-foreground">WEIGHT / kg</p>
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {record.driver_name ? (
        <span>
          Driver: <span className="font-medium text-foreground">{record.driver_name}</span>
          {record.vehicle_plate_number ? ` · ${record.vehicle_plate_number}` : ''}
        </span>
      ) : null}
      {photoUrl ? (
        <a
          href={photoUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
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
  const status = getDisplayStatus(record)

  return (
    <RecordCard
      icon={<Recycle strokeWidth={1.8} />}
      iconClassName={BIN_TYPE_TONES.recycle.soft}
      title={`#${record.bin_code}`}
      subtitle={
        <>
          {record.contractor_name}{' '}
          <span className="font-normal text-muted-foreground">· {record.site_name}</span>
        </>
      }
      meta={
        recordedAt
          ? `${isPickedUp ? '' : 'Scheduled for '}${formatCollectedAt(recordedAt)}`
          : undefined
      }
      details={
        <>
          <RecordDetail label="Item count" className="xl:w-[100px]">
            {record.item_count} items
          </RecordDetail>
          <RecordDetail label={isPickedUp ? 'Staff Weight' : 'Bin Weight'} className="xl:w-[110px]">
            {formatRecordedWeight(getRecordedWeight(record))}
          </RecordDetail>
          {isPickedUp && record.driver_weight_kg !== null ? (
            <RecordDetail label="Driver Weight" className="xl:w-[110px]">
              {formatRecordedWeight(record.driver_weight_kg)}
            </RecordDetail>
          ) : null}
          {record.weight_variance_percent !== null ? (
            <RecordDetail label="Difference" className="xl:w-[140px]">
              {record.staff_weight_kg !== null && record.driver_weight_kg !== null
                ? formatWeightDifference(
                    getWeightDifferenceKg(record.staff_weight_kg, record.driver_weight_kg),
                    record.weight_variance_percent,
                  )
                : formatVariancePercent(record.weight_variance_percent)}
            </RecordDetail>
          ) : null}
        </>
      }
      status={
        <Badge variant={HANDOFF_STATUS_BADGE_VARIANTS[status]}>
          {handoffRecordStatusLabels[status]}
        </Badge>
      }
    >
      {isPickedUp ? <PickupEvidence record={record} /> : null}

      {record.status === 'disputed' ? (
        <Alert variant="destructive" role="note">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            The staff and driver weights differ by more than 3%. This handoff is waiting for manager
            approval before it can be closed.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isPickedUp ? null : record.outcomes ? (
        <MaterialOutcomesSection
          outcomes={record.outcomes}
          recordedWeightKg={getRecordedWeight(record)}
        />
      ) : (
        <PendingOutcomeNotice />
      )}
    </RecordCard>
  )
}
