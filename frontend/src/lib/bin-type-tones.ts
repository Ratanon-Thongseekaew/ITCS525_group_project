import type { ComponentProps } from 'react'
import type { BinRecord, BinType } from '@/api'
import type { Badge } from '@/components/ui/badge'

export type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

interface BinTypeTone {
  /** Soft `Badge` and `Alert` variant. */
  variant: 'resale' | 'recycle' | 'repair'
  /** Solid fill for the quick-tap sort buttons. */
  solid: string
  /** Icon tile and soft surface. */
  soft: string
  /** Small dot or bar fill. */
  fill: string
  /** Colors the indicator of a `Progress`. */
  progress: string
  /** Selected state of a `ToggleGroupItem`. */
  toggleOn: string
}

// Literal class strings so Tailwind can find them. Colors come from the bin-type tokens in styles.css.
export const BIN_TYPE_TONES: Record<BinType, BinTypeTone> = {
  resale: {
    variant: 'resale',
    solid: 'bg-resale text-resale-foreground hover:bg-resale/90 focus-visible:ring-resale/40',
    soft: 'bg-resale-soft text-resale-soft-foreground',
    fill: 'bg-resale',
    progress: 'bg-resale-soft [&>[data-slot=progress-indicator]]:bg-resale',
    toggleOn:
      'data-[state=on]:border-resale data-[state=on]:bg-resale-soft data-[state=on]:text-resale-soft-foreground',
  },
  recycle: {
    variant: 'recycle',
    solid: 'bg-recycle text-recycle-foreground hover:bg-recycle/90 focus-visible:ring-recycle/40',
    soft: 'bg-recycle-soft text-recycle-soft-foreground',
    fill: 'bg-recycle',
    progress: 'bg-recycle-soft [&>[data-slot=progress-indicator]]:bg-recycle',
    toggleOn:
      'data-[state=on]:border-recycle data-[state=on]:bg-recycle-soft data-[state=on]:text-recycle-soft-foreground',
  },
  repair: {
    variant: 'repair',
    solid: 'bg-repair text-repair-foreground hover:bg-repair/90 focus-visible:ring-repair/40',
    soft: 'bg-repair-soft text-repair-soft-foreground',
    fill: 'bg-repair',
    progress: 'bg-repair-soft [&>[data-slot=progress-indicator]]:bg-repair',
    toggleOn:
      'data-[state=on]:border-repair data-[state=on]:bg-repair-soft data-[state=on]:text-repair-soft-foreground',
  },
}

export const BIN_STATUS_BADGE_VARIANTS: Record<BinRecord['status'], BadgeVariant> = {
  active: 'info',
  ready: 'success',
  handed_off: 'secondary',
  closed: 'secondary',
}
