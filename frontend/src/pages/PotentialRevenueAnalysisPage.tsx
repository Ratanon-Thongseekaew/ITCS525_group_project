import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getDirectResaleBins } from '@/api'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { Button } from '@/components/ui/button'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'

export function PotentialRevenueAnalysisPage() {
  const workspace = useHandoffWorkspace()
  const { siteId } = workspace
  const loadBins = useCallback(
    (signal: AbortSignal) => getDirectResaleBins(siteId!, signal),
    [siteId],
  )
  const resource = useApiResource(
    siteId === null ? null : `direct-resale:${siteId}`,
    loadBins,
    'Revenue data could not be loaded.',
  )
  const processed = (resource.data ?? []).filter((bin) => bin.status === 'processed')
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
          <strong className="font-semibold text-slate-900">Revenue Summary</strong>
        </nav>

        <div className="mt-5">
          <HandoffActorBar workspace={workspace} />
        </div>
        <header className="mt-6 border-b border-slate-200 pb-6 sm:mt-8 sm:pb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revenue Summary</h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Total revenue recorded from bins that have been processed.
          </p>
        </header>

        <section className="mt-7 rounded-2xl border border-slate-200 p-5 sm:p-7">
          <h2 className="text-base font-semibold">Total recorded revenue</h2>
          {resource.isLoading ? (
            <p className="my-5 text-sm text-slate-500">Loading revenue…</p>
          ) : resource.error ? (
            <p className="my-5 text-sm text-rose-700" role="alert">
              {resource.error}
            </p>
          ) : siteId === null ? (
            <p className="my-5 text-sm text-slate-500">
              Choose a staff account to see its site revenue.
            </p>
          ) : (
            <>
              <div className="my-5 text-4xl font-bold tracking-tight text-teal-700 sm:text-5xl">
                ฿{totalRevenue.toLocaleString('en-US')}
              </div>
              <p className="mb-5 text-sm text-slate-500">From {processed.length} processed bins</p>
            </>
          )}
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
