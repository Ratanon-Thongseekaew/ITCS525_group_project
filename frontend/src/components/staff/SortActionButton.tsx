import type { ReactNode } from 'react'
import type { BinType } from '@/api'
import { BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { cn } from '@/lib/utils'

interface SortActionButtonProps {
  type: BinType
  icon: ReactNode
  label: string
  /** Where the garment goes, shown under the label. */
  hint: ReactNode
  /** Keyboard shortcut, shown as a chip, such as "[R] or [1]". */
  shortcut: string
  disabled?: boolean
  onClick: () => void
}

/** A large solid quick-tap button that sorts one garment into a bin type. */
export function SortActionButton({
  type,
  icon,
  label,
  hint,
  shortcut,
  disabled,
  onClick,
}: SortActionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl p-6 text-center shadow-sm transition-all outline-none focus-visible:ring-4 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        BIN_TYPE_TONES[type].solid,
      )}
    >
      <span
        className="absolute top-3 right-3 rounded bg-black/20 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
        aria-hidden="true"
      >
        Key: {shortcut}
      </span>
      <span
        className="mb-1 transition-transform group-hover:scale-110 [&_svg]:size-10"
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="text-2xl font-extrabold tracking-tight">{label}</span>
      <span className="text-xs font-medium opacity-90">{hint}</span>
    </button>
  )
}
