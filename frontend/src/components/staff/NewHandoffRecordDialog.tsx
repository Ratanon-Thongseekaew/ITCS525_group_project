import { useState } from 'react'
import { ArchiveRestore } from 'lucide-react'
import { recordHandoffAtPickup } from '@/api'
import {
  BinSummary,
  ContractorField,
  HandoffDialogShell,
  PickupDateTimeFields,
  PickupEvidenceFields,
} from '@/components/staff/handoff-form'
import {
  emptyPickupEvidence,
  toPickupPayload,
  validatePickupEvidence,
  type PickupEvidenceErrors,
} from '@/lib/handoff-evidence'
import { currentPickupSlot, formatPackedAt, toOffsetIso } from '@/lib/handoff-format'
import { errorMessage } from '@/lib/use-api-resource'
import type { HandoffContractorOption, HandoffReadyBin, HandoffRecord } from '@/types/handoff'

type ScheduleErrors = { contractor?: string; date?: string; time?: string }

interface NewHandoffRecordDialogProps {
  bin: HandoffReadyBin
  contractors: readonly HandoffContractorOption[]
  actorId: number
  onClose: () => void
  onRecorded: (record: HandoffRecord) => void
  onCloseAutoFocus?: (event: Event) => void
}

/** Records a handoff when the contractor's driver arrives: contractor, time, and pickup evidence. */
export function NewHandoffRecordDialog({
  bin,
  contractors,
  actorId,
  onClose,
  onRecorded,
  onCloseAutoFocus,
}: NewHandoffRecordDialogProps) {
  const [slot] = useState(() => currentPickupSlot())
  const [contractorId, setContractorId] = useState('')
  const [date, setDate] = useState(slot.date)
  const [time, setTime] = useState(slot.time)
  const [evidence, setEvidence] = useState(() => emptyPickupEvidence(bin.total_weight_kg))
  const [errors, setErrors] = useState<ScheduleErrors>({})
  const [evidenceErrors, setEvidenceErrors] = useState<PickupEvidenceErrors>({})
  const [pending, setPending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  async function handleSubmit() {
    const nextErrors: ScheduleErrors = {}
    if (!contractorId) nextErrors.contractor = 'Select a contractor.'
    if (!date) nextErrors.date = 'Select a pickup date.'
    if (!time) nextErrors.time = 'Select a pickup time.'
    // The pickup has already happened, so its time can't be later than now.
    if (date && time && new Date(`${date}T${time}:00`).getTime() > Date.now()) {
      nextErrors.time = "Pickup time can't be in the future."
    }
    const nextEvidenceErrors = validatePickupEvidence(evidence)
    setErrors(nextErrors)
    setEvidenceErrors(nextEvidenceErrors)
    if (Object.keys(nextErrors).length || Object.keys(nextEvidenceErrors).length) return

    setPending(true)
    setRequestError(null)
    try {
      const record = await recordHandoffAtPickup({
        bin_id: bin.id,
        contractor_id: Number(contractorId),
        actor_id: actorId,
        picked_up_at: toOffsetIso(date, time),
        ...toPickupPayload(evidence),
      })
      onRecorded(record)
    } catch (error) {
      setRequestError(errorMessage(error, 'The handoff could not be saved. Try again.'))
      setPending(false)
    }
  }

  return (
    <HandoffDialogShell
      title="New Handoff Record"
      description={`Record the contractor pickup for bin #${bin.code}.`}
      submitLabel="Confirm Handoff"
      submitIcon={<ArchiveRestore aria-hidden="true" />}
      pending={pending}
      error={requestError}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <BinSummary
        code={bin.code}
        itemCount={bin.item_count}
        weightKg={bin.total_weight_kg}
        detail={`Recycling Bin · ${bin.site_name}`}
        footer={bin.ready_at ? `Packed at ${formatPackedAt(bin.ready_at)}` : 'Ready for handoff'}
      />
      <ContractorField
        contractors={contractors}
        value={contractorId}
        error={errors.contractor}
        onChange={(value) => {
          setContractorId(value)
          setErrors((current) => ({ ...current, contractor: undefined }))
        }}
      />
      <PickupDateTimeFields
        date={date}
        time={time}
        errors={errors}
        onDateChange={(value) => {
          setDate(value)
          setErrors((current) => ({ ...current, date: undefined }))
        }}
        onTimeChange={(value) => {
          setTime(value)
          setErrors((current) => ({ ...current, time: undefined }))
        }}
      />
      <PickupEvidenceFields
        value={evidence}
        errors={evidenceErrors}
        onChange={(next) => {
          setEvidence(next)
          setEvidenceErrors({})
        }}
      />
    </HandoffDialogShell>
  )
}
