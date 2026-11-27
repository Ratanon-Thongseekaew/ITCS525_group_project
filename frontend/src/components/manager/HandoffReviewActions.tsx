import { useState } from 'react'
import { CircleCheck, Clock3, Lock } from 'lucide-react'
import { approveHandoff, closeHandoff } from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatRecordedWeight, formatVariancePercent, formatWeightKg } from '@/lib/handoff-format'
import { canApprove, canClose, getOutcomeTotal, getRecordedWeight } from '@/lib/handoff-records'
import { errorMessage } from '@/lib/use-api-resource'
import type { HandoffRecord } from '@/types/handoff'

type ReviewAction = 'approve' | 'close'

interface HandoffReviewActionsProps {
  record: HandoffRecord
  /** The signed-in manager or administrator, sent as the API's `actor_id`. */
  actorId: number
  /** Called with the updated record after an approval or close succeeds. */
  onUpdated: (record: HandoffRecord) => void
}

const ACTION_FAILED = 'The handoff could not be updated. Try again.'

/** A manager's approve and close controls for one handoff record. */
export function HandoffReviewActions({ record, actorId, onUpdated }: HandoffReviewActionsProps) {
  const [confirming, setConfirming] = useState<ReviewAction | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const showApprove = canApprove(record)
  const showClose = record.status === 'picked_up' || record.status === 'approved'
  if (!showApprove && !showClose) return null

  const closeEnabled = canClose(record)

  async function run(action: ReviewAction) {
    setIsSaving(true)
    setError(null)
    try {
      const updated =
        action === 'approve'
          ? await approveHandoff(record.id, actorId)
          : await closeHandoff(record.id, actorId)
      setConfirming(null)
      onUpdated(updated)
    } catch (caught) {
      setConfirming(null)
      setError(errorMessage(caught, ACTION_FAILED))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        {showClose && !closeEnabled ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Waiting for the contractor&apos;s outcome report
          </p>
        ) : null}
        {showApprove ? (
          <Button disabled={isSaving} onClick={() => setConfirming('approve')}>
            <CircleCheck aria-hidden="true" />
            Approve
          </Button>
        ) : null}
        {showClose ? (
          <Button
            variant="outline"
            disabled={isSaving || !closeEnabled}
            onClick={() => setConfirming('close')}
          >
            <Lock aria-hidden="true" />
            Close Handoff
          </Button>
        ) : null}
      </div>

      {confirming === 'approve' ? (
        <ConfirmDialog
          title={`Approve #${record.bin_code}?`}
          description="The staff and driver weights differ by more than 3%. Approving accepts the recorded weights so the handoff can be closed once its outcome report is in."
          confirmLabel={isSaving ? 'Approving…' : 'Approve'}
          onConfirm={() => void run('approve')}
          onCancel={() => setConfirming(null)}
        >
          <dl className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Staff weight</dt>
              <dd className="font-medium">
                {record.staff_weight_kg === null
                  ? '—'
                  : formatRecordedWeight(record.staff_weight_kg)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Driver weight</dt>
              <dd className="font-medium">
                {record.driver_weight_kg === null
                  ? '—'
                  : formatRecordedWeight(record.driver_weight_kg)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Difference</dt>
              <dd className="font-medium">
                {record.weight_variance_percent === null
                  ? '—'
                  : formatVariancePercent(record.weight_variance_percent)}
              </dd>
            </div>
          </dl>
        </ConfirmDialog>
      ) : null}

      {confirming === 'close' && record.outcomes ? (
        <ConfirmDialog
          title={`Close #${record.bin_code}?`}
          description="Closing confirms you have reviewed the reported outcomes. The handoff and its bin are closed and can't be changed afterwards."
          confirmLabel={isSaving ? 'Closing…' : 'Close Handoff'}
          onConfirm={() => void run('close')}
          onCancel={() => setConfirming(null)}
        >
          <dl className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Recorded weight</dt>
              <dd className="font-medium">{formatWeightKg(getRecordedWeight(record))}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total reported</dt>
              <dd className="font-medium">{formatWeightKg(getOutcomeTotal(record.outcomes))}</dd>
            </div>
          </dl>
        </ConfirmDialog>
      ) : null}
    </div>
  )
}
