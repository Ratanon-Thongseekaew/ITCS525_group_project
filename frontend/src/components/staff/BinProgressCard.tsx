import { Archive } from 'lucide-react'
import type { BinRecord, BinType } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'

const BIN_CARD_COPY: Record<BinType, { title: string; destination: string; empty: string }> = {
  resale: {
    title: 'Direct Resale Bin',
    destination: 'Destined for Feature 3 Resale Processing',
    empty: 'No active resale bin. Sort an item or click "New Bin Record" to start one.',
  },
  recycle: {
    title: 'Recycling Bin',
    destination: 'Destined for Feature 4 Contractor Handoff',
    empty: 'No active recycling bin. Sort an item or click "New Bin Record" to start one.',
  },
  repair: {
    title: 'Repair Bin',
    destination: 'For the repair partner',
    empty: 'No active repair bin. Sort a Repair / Upcycle item to start one.',
  },
}

interface BinProgressCardProps {
  type: BinType
  bin: BinRecord | null
  onSeal: (binId: number) => void
}

/** The active bin of one type: code, fill level, weight, and a Seal button. */
export function BinProgressCard({ type, bin, onSeal }: BinProgressCardProps) {
  const copy = BIN_CARD_COPY[type]
  const tone = BIN_TYPE_TONES[type]
  const percent = bin ? Math.min(100, Math.round((bin.item_count / bin.max_capacity) * 100)) : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
        <div className="flex flex-col gap-1">
          <Badge variant={tone.variant} className="tracking-wider uppercase">
            {copy.title}
          </Badge>
          <CardTitle className="text-lg font-bold">{bin?.bin_code ?? 'None Active'}</CardTitle>
        </div>
        {bin ? (
          <Button variant="outline" size="sm" onClick={() => onSeal(bin.id)}>
            <Archive aria-hidden="true" />
            Seal / Close Bin
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-1">
        {bin ? (
          <>
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              <span>
                Capacity: {bin.item_count} / {bin.max_capacity} items
              </span>
              <span>{percent}%</span>
            </div>
            <Progress
              value={percent}
              className={tone.progress}
              aria-label={`${copy.title} capacity`}
            />
            <p className="text-xs text-muted-foreground">
              Total Weight: {bin.total_weight_kg} kg • {copy.destination}
            </p>
          </>
        ) : (
          <p className="py-3 text-xs text-muted-foreground">{copy.empty}</p>
        )}
      </CardContent>
    </Card>
  )
}
