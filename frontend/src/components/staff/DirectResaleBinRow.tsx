import { Shirt } from 'lucide-react'
import type { DirectResaleBinRecord } from '@/api'
import { formatPackedAt } from '@/lib/handoff-format'

interface DirectResaleBinRowProps {
  bin: DirectResaleBinRecord
  /** Makes the row a button. Omit it for read-only rows such as processed records. */
  onSelect?: () => void
}

export function DirectResaleBinRow({ bin, onSelect }: DirectResaleBinRowProps) {
  const isProcessed = bin.status === 'processed'
  const content = (
    <>
      <span className="grid size-11 place-items-center rounded-xl bg-slate-50 text-teal-700 sm:size-14">
        <Shirt className="size-5 sm:size-6" />
      </span>
      <span className="col-span-2 grid gap-1.5 sm:col-span-1">
        <strong className="text-lg">#{bin.bin_code}</strong>
        <b className="text-sm font-medium text-teal-700">Direct Resale Bin</b>
        <small className="text-xs text-muted-foreground">
          Packed at&nbsp; {formatPackedAt(bin.packed_at)}
        </small>
      </span>
      <span className="grid gap-1.5">
        <small className="text-xs text-muted-foreground">Item count</small>
        <strong className="text-base">{bin.item_count} items</strong>
      </span>
      <span className="grid gap-1.5">
        <small className="text-xs text-muted-foreground">Grossed Weight</small>
        <strong className="text-base">{bin.total_weight_kg}kg</strong>
      </span>
      <span className="grid gap-1.5">
        <small className="text-xs text-muted-foreground">Status</small>
        <em className="w-fit rounded-full bg-teal-50 px-3 py-1 text-xs not-italic text-teal-700">
          {isProcessed ? 'Processed' : 'Awaiting Process'}
        </em>
        {isProcessed && bin.revenue !== null && (
          <>
            <small className="mt-1 text-xs text-muted-foreground">Recorded revenue</small>
            <strong className="text-base">฿{bin.revenue.toLocaleString('en-US')}</strong>
          </>
        )}
      </span>
    </>
  )

  if (onSelect) {
    return (
      <button
        className="grid min-h-40 w-full grid-cols-[44px_1fr_1fr] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:grid-cols-[56px_minmax(200px,1.4fr)_repeat(3,minmax(110px,0.55fr))] sm:gap-4 sm:p-7"
        onClick={onSelect}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <article className="grid min-h-40 w-full grid-cols-[44px_1fr_1fr] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left sm:grid-cols-[56px_minmax(200px,1.4fr)_repeat(3,minmax(110px,0.55fr))] sm:gap-4 sm:p-7">
      {content}
    </article>
  )
}
