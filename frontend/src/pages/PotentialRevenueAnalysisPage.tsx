import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { directResaleBins } from '@/lib/mock-direct-resale-bins'

export function PotentialRevenueAnalysisPage() {
  const processed = directResaleBins.filter((bin) => bin.status === 'Processed')
  const totalRevenue = processed.reduce((sum, bin) => sum + (bin.revenue ?? 0), 0)

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-white text-slate-900">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <nav className="text-xs text-slate-500 sm:text-sm" aria-label="Breadcrumb">
          Operations <span className="mx-2 text-slate-300">/</span>
          <Link className="hover:text-teal-700" to="/staff/direct-resale">
            Direct Resale
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <strong className="font-semibold text-slate-900">Potential Revenue Analysis</strong>
        </nav>

        <header className="mt-6 border-b border-slate-200 pb-6 sm:mt-8 sm:pb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Potential Revenue Analysis
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Revenue recorded from processed direct resale bins
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-200 p-5 sm:p-7">
          <h2 className="text-base font-semibold">Total potential revenue</h2>
          <div className="my-5 text-4xl font-bold tracking-tight text-teal-700 sm:text-5xl">
            ฿{totalRevenue.toLocaleString('en-US')}
          </div>
          <p className="mb-5 text-sm text-slate-500">{processed.length} processed bins</p>
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
