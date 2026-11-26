import { Shirt } from 'lucide-react'
import type { DirectResaleBinRecord } from '@/api'
import { RecordCard, RecordDetail } from '@/components/RecordCard'
import { Badge } from '@/components/ui/badge'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { formatPackedAt } from '@/lib/handoff-format'

interface DirectResaleBinRowProps {
  bin: DirectResaleBinRecord
  /** Makes the row clickable. Omit it for read-only rows such as processed records. */
  onSelect?: () => void
}

export function DirectResaleBinRow({ bin, onSelect }: DirectResaleBinRowProps) {
  const isProcessed = bin.status === 'processed'

  return (
    <RecordCard
      icon={<Shirt strokeWidth={1.8} />}
      iconClassName={BIN_TYPE_TONES.resale.soft}
      title={`#${bin.bin_code}`}
      subtitle={<span className="text-resale-soft-foreground">Direct Resale Bin</span>}
      meta={`Packed at ${formatPackedAt(bin.packed_at)}`}
      onSelect={onSelect}
      selectProps={onSelect ? { 'aria-haspopup': 'dialog' } : undefined}
      details={
        <>
          <RecordDetail label="Item count" className="xl:w-[110px]">
            {bin.item_count} items
          </RecordDetail>
          <RecordDetail label="Grossed Weight" className="xl:w-[120px]">
            {bin.total_weight_kg} kg
          </RecordDetail>
          {isProcessed && bin.revenue !== null ? (
            <RecordDetail label="Recorded revenue" className="xl:w-[140px]">
              ฿{bin.revenue.toLocaleString('en-US')}
            </RecordDetail>
          ) : null}
        </>
      }
      status={
        <Badge variant={isProcessed ? 'success' : 'warning'}>
          {isProcessed ? 'Processed' : 'Awaiting Process'}
        </Badge>
      }
    />
  )
}
