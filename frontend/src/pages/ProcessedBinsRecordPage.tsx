import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { Button } from '@/components/ui/button'
import { directResaleBins } from '@/lib/mock-direct-resale-bins'

export function ProcessedBinsRecordPage() {
  const processed = directResaleBins.filter((bin) => bin.status === 'Processed')

  return (
    <div className="resale-workspace">
      <div className="resale-main">
        <div className="resale-topline">
          <div>
            <span>Operations</span>
            <span className="resale-slash">/</span>
            <Link to="/staff/direct-resale">Direct Resale</Link>
            <span className="resale-slash">/</span>
            <strong>Processed Bin Records</strong>
          </div>
        </div>
        <header className="resale-heading">
          <div>
            <h1>Processed Bin Records</h1>
            <p>Direct resale bins that have been processed and had revenue recorded</p>
          </div>
          <div className="resale-heading__actions">
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale">
                <ArrowLeft /> Back to bins
              </Link>
            </Button>
          </div>
        </header>

        <section className="resale-bins">
          <h2>Processed bin records</h2>
          {processed.length ? (
            processed.map((bin) => <DirectResaleBinRow bin={bin} key={bin.id} />)
          ) : (
            <div className="resale-empty">No processed bins yet.</div>
          )}
          <p className="resale-record-count">
            Showing {processed.length} of {processed.length} records
          </p>
        </section>
      </div>
    </div>
  )
}
