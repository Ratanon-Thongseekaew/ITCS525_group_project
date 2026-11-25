import type { DashboardOutcome } from '@/api'

export type OutcomeCategory = DashboardOutcome['category']

interface OutcomeTone {
  label: string
  /** CSS color for Recharts series, such as a `ChartConfig` color. */
  chartColor: string
  /** Small legend or header dot. */
  dot: string
  /** Light tint for a table column. */
  tint: string
}

// Literal class strings so Tailwind can find them. Colors come from the --outcome-* tokens.
export const OUTCOME_TONES: Record<OutcomeCategory, OutcomeTone> = {
  upcycled: {
    label: 'Upcycled',
    chartColor: 'var(--outcome-upcycled)',
    dot: 'bg-outcome-upcycled',
    tint: 'bg-outcome-upcycled/10',
  },
  fibre_to_fibre: {
    label: 'Fibre-to-fibre',
    chartColor: 'var(--outcome-fibre-to-fibre)',
    dot: 'bg-outcome-fibre-to-fibre',
    tint: 'bg-outcome-fibre-to-fibre/10',
  },
  downcycled: {
    label: 'Downcycled',
    chartColor: 'var(--outcome-downcycled)',
    dot: 'bg-outcome-downcycled',
    tint: 'bg-outcome-downcycled/10',
  },
  exported: {
    label: 'Exported',
    chartColor: 'var(--outcome-exported)',
    dot: 'bg-outcome-exported',
    tint: 'bg-outcome-exported/10',
  },
  landfilled: {
    label: 'Landfilled',
    chartColor: 'var(--outcome-landfilled)',
    dot: 'bg-outcome-landfilled',
    tint: 'bg-outcome-landfilled/10',
  },
  incinerated_energy_recovery: {
    label: 'Incinerated with energy recovery',
    chartColor: 'var(--outcome-incinerated)',
    dot: 'bg-outcome-incinerated',
    tint: 'bg-outcome-incinerated/10',
  },
}

export const OUTCOME_CATEGORIES = Object.keys(OUTCOME_TONES) as OutcomeCategory[]
