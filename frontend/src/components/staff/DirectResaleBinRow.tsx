import { Shirt } from 'lucide-react'
import type { DirectResaleBin } from '@/lib/mock-direct-resale-bins'

interface DirectResaleBinRowProps {
  bin: DirectResaleBin
  /** Makes the row a button. Omit it for read-only rows such as processed records. */
  onSelect?: () => void
}

export function DirectResaleBinRow({ bin, onSelect }: DirectResaleBinRowProps) {
  const content = (
    <>
      <span className="resale-bin__icon">
        <Shirt />
      </span>
      <span className="resale-bin__identity">
        <strong>#{bin.id}</strong>
        <b>Direct Resale Bin</b>
        <small>Packed at&nbsp; {bin.packed}</small>
      </span>
      <span className="resale-bin__stat">
        <small>Item count</small>
        <strong>{bin.count} items</strong>
      </span>
      <span className="resale-bin__stat">
        <small>Grossed Weight</small>
        <strong>{bin.weight}kg</strong>
      </span>
      <span className="resale-bin__stat">
        <small>Status</small>
        <em className={bin.status === 'Processed' ? 'is-processed' : ''}>{bin.status}</em>
      </span>
    </>
  )

  if (onSelect) {
    return (
      <button className="resale-bin" onClick={onSelect} type="button">
        {content}
      </button>
    )
  }

  return <article className="resale-bin resale-bin--static">{content}</article>
}
