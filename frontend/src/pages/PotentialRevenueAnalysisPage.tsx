import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { directResaleBins } from '@/lib/mock-direct-resale-bins'

export function PotentialRevenueAnalysisPage() {
  const processed = directResaleBins.filter((bin) => bin.status === 'Processed')
  const totalRevenue = processed.reduce((sum, bin) => sum + (bin.revenue ?? 0), 0)

  return (
    <div className="resale-workspace">
      <div className="resale-main">
        <div className="resale-topline">
          <div>
            <span>Operations</span>
            <span className="resale-slash">/</span>
            <Link to="/staff/direct-resale">Direct Resale</Link>
            <span className="resale-slash">/</span>
            <strong>Potential Revenue Analysis</strong>
          </div>
        </div>
        <header className="resale-heading">
          <div>
            <h1>Potential Revenue Analysis</h1>
            <p>Revenue recorded from processed direct resale bins</p>
          </div>
        </header>

        <section className="resale-content-panel">
          <h2>Total potential revenue</h2>
          <div className="resale-analysis-total">฿{totalRevenue.toLocaleString('en-US')}</div>
          <p>{processed.length} processed bins</p>
          <Button asChild variant="outline">
            <Link to="/staff/direct-resale">
              <ArrowLeft /> Back to bins
            </Link>
          </Button>
        </section>
      </div>
    </div>
  )
}
