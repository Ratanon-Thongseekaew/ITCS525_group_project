import { Shirt } from 'lucide-react'
import { RecordCard, RecordDetail } from '@/components/RecordCard'
import { Badge } from '@/components/ui/badge'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import type { DirectResaleBin } from '@/lib/mock-direct-resale-bins'

interface DirectResaleBinRowProps {
  bin: DirectResaleBin
  /** Makes the row clickable. Omit it for read-only rows such as processed records. */
  onSelect?: () => void
}

export function DirectResaleBinRow({ bin, onSelect }: DirectResaleBinRowProps) {
  return (
    <RecordCard
      icon={<Shirt strokeWidth={1.8} />}
      iconClassName={BIN_TYPE_TONES.resale.soft}
      title={`#${bin.id}`}
      subtitle={<span className="text-resale-soft-foreground">Direct Resale Bin</span>}
      meta={`Packed at ${bin.packed}`}
      onSelect={onSelect}
      selectProps={onSelect ? { 'aria-haspopup': 'dialog' } : undefined}
      details={
        <>
          <RecordDetail label="Item count" className="xl:w-[110px]">
            {bin.count} items
          </RecordDetail>
          <RecordDetail label="Grossed Weight" className="xl:w-[120px]">
            {bin.weight}kg
          </RecordDetail>
        </>
      }
      status={
        <Badge variant={bin.status === 'Processed' ? 'success' : 'warning'}>{bin.status}</Badge>
      }
    />
  )
}
