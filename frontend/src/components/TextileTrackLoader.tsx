import type { CSSProperties } from 'react'

import arrowsAsset from '@/assets/logos/textile-track-loader-arrows.png'
import centerAsset from '@/assets/logos/textile-track-loader-center.png'
import { cn } from '@/lib/utils'

type TextileTrackLoaderProps = {
  className?: string
  /** Set an empty string to hide the visible status message. */
  label?: string
  /** Fill the viewport with the loading-screen background. */
  fullScreen?: boolean
  /** Width and height of the animated logo in pixels. */
  size?: number
}

export function TextileTrackLoader({
  className,
  label = 'กำลังโหลดข้อมูล...',
  fullScreen = true,
  size = 128,
}: TextileTrackLoaderProps) {
  const markStyle = {
    '--textile-loader-size': `${size}px`,
  } as CSSProperties

  return (
    <div
      className={cn(
        'grid place-items-center content-center gap-4 text-[var(--color-muted)]',
        fullScreen && 'min-h-screen min-h-svh w-full bg-[#f8fafc] text-[var(--color-muted)]',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label || 'กำลังโหลด'}
    >
      <div
        className="textile-loader__mark relative isolate size-[var(--textile-loader-size)] [filter:drop-shadow(0_12px_22px_rgba(15,118,110,0.16))]"
        style={markStyle}
        aria-hidden="true"
      >
        <img
          className="textile-loader__center pointer-events-none absolute inset-0 z-10 block size-full select-none object-contain"
          src={centerAsset}
          alt=""
          draggable={false}
        />
        <img
          className="textile-loader__arrows pointer-events-none absolute inset-0 z-20 block size-full origin-center select-none object-contain [animation:textile-track-spin_1.65s_linear_infinite] motion-reduce:animate-none"
          src={arrowsAsset}
          alt=""
          draggable={false}
        />
      </div>

      {label ? <span className="text-sm font-bold tracking-wide">{label}</span> : null}
    </div>
  )
}
