import { useRef, useState, type MouseEvent } from 'react'
import { ArchiveRestore, CalendarDays, Recycle } from 'lucide-react'
import { Link } from 'react-router'
import { actionButtonClass, BinDetail, cardClass } from '@/components/staff/handoff-ui'
import { NewHandoffRecordDialog } from '@/components/staff/NewHandoffRecordDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatPackedAt, formatPickupDate } from '@/lib/handoff-format'
import { newHandoffBins, nextScheduledPickup } from '@/lib/mock-handoff-bins'
import {
  handoffStatusLabels,
  type HandoffBin,
  type HandoffBinStatus,
  type NewHandoffRecord,
} from '@/types/handoff'

const sectionHeadingClass = 'text-sm font-medium text-slate-900'

interface SummaryMetricProps {
  label: string
  value: string
  highlight?: boolean
}

function SummaryMetric({ label, value, highlight = false }: SummaryMetricProps) {
  const valueClass = highlight
    ? 'text-[22px] leading-[26.4px] tracking-[-0.5px] text-teal-700'
    : 'text-[26px] leading-[26px] tracking-[-1px] text-slate-900'

  return (
    <Card className={cardClass}>
      <CardContent className="flex h-[132px] flex-col justify-between p-6">
        <dt className="text-sm text-slate-500">{label}</dt>
        <dd className={`font-medium ${valueClass}`}>{value}</dd>
      </CardContent>
    </Card>
  )
}

function HandoffStatusBadge({ status }: { status: HandoffBinStatus }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-amber-600">
      {handoffStatusLabels[status]}
    </span>
  )
}

interface BinRecordCardProps {
  bin: HandoffBin
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void
}

function BinRecordCard({ bin, onSelect }: BinRecordCardProps) {
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
                className="cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-[14px] focus-visible:after:ring-2 focus-visible:after:ring-teal-600"
                onClick={onSelect}
              >
                #{bin.bin_code}
              </button>
            </h3>
            <p className="text-sm font-medium text-amber-600">Recycling Bin</p>
            <p className="text-xs text-slate-500">Packed at {formatPackedAt(bin.packed_at)}</p>
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
              <HandoffStatusBadge status={bin.status} />
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

export function NewBinsForHandoffPage() {
  const [bins, setBins] = useState(newHandoffBins)
  const [selectedBin, setSelectedBin] = useState<HandoffBin | null>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const itemsStaged = bins.reduce((sum, bin) => sum + bin.item_count, 0)
  const totalWeight = bins.reduce((sum, bin) => sum + bin.total_weight_kg, 0)

  function handleConfirm(record: NewHandoffRecord) {
    // The clicked card is removed, so focus moves to the list heading instead.
    returnFocusRef.current = listHeadingRef.current
    setBins((current) => current.filter((bin) => bin.id !== record.bin_id))
    setSelectedBin(null)
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
            <p className="text-sm text-slate-500">Tap to assign contractor and handoff</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className={actionButtonClass}>
              <Link to="/staff/recycle-bin-handoff/pickup-dates">
                <CalendarDays aria-hidden="true" />
                Scheduled Pickup Dates
              </Link>
            </Button>
            <Button asChild variant="outline" className={actionButtonClass}>
              <Link to="/staff/recycle-bin-handoff/records">
                <ArchiveRestore aria-hidden="true" />
                Handoff Records
              </Link>
            </Button>
          </div>
        </header>
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
          <SummaryMetric
            label="Next Scheduled Pickup"
            value={nextScheduledPickup ? formatPickupDate(nextScheduledPickup) : '—'}
            highlight
          />
        </dl>
      </section>

      <section className="flex flex-col gap-4">
        <h2 ref={listHeadingRef} tabIndex={-1} className={`outline-none ${sectionHeadingClass}`}>
          Bins awaiting handoff
        </h2>
        {bins.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {bins.map((bin) => (
              <li key={bin.id}>
                <BinRecordCard
                  bin={bin}
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
      </section>

      {selectedBin && (
        <NewHandoffRecordDialog
          bin={selectedBin}
          defaultPickup={nextScheduledPickup}
          onClose={() => setSelectedBin(null)}
          onConfirm={handleConfirm}
          onCloseAutoFocus={(event) => {
            // Radix only restores focus to its own DialogTrigger, which this dialog doesn't use.
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
        />
      )}
    </section>
  )
}
