import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getDirectResaleBins } from '@/api'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { Button } from '@/components/ui/button'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'

export function ProcessedBinsRecordPage() {
  const workspace = useHandoffWorkspace()
  const { siteId } = workspace
  const loadBins = useCallback(
    (signal: AbortSignal) => getDirectResaleBins(siteId!, signal),
    [siteId],
  )
  const resource = useApiResource(
    siteId === null ? null : `direct-resale:${siteId}`,
    loadBins,
    'Processed bins could not be loaded.',
  )
  const processed = (resource.data ?? []).filter((bin) => bin.status === 'processed')

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-white text-slate-900">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <nav className="text-xs text-slate-500 sm:text-sm" aria-label="Breadcrumb">
          Operations <span className="mx-2 text-slate-300">/</span>
          <Link className="hover:text-teal-700" to="/staff/direct-resale">
            Direct Resale
          </Link>
          <span className="mx-2 text-slate-300">/</span>
          <strong className="font-semibold text-slate-900">Processed Bin History</strong>
        </nav>

        <div className="mt-5">
          <HandoffActorBar workspace={workspace} />
        </div>
        <header className="mt-6 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:mt-8 sm:pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Processed Bin History
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Bins that have completed processing, with their recorded revenue and bin details.
            </p>
          </div>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/staff/direct-resale">
              <ArrowLeft /> Back to bins
            </Link>
          </Button>
        </header>

        <section className="mt-7" aria-labelledby="processed-bins-title">
          <h2 id="processed-bins-title" className="mb-4 text-base font-semibold">
            Completed bins
          </h2>
          {siteId === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Choose a staff account to see its processed bins.
            </p>
          ) : resource.isLoading ? (
            <p className="p-6 text-sm text-slate-500" role="status">
              Loading processed bins…
            </p>
          ) : resource.error ? (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              role="alert"
            >
              {resource.error}
            </p>
          ) : (
            <div className="grid gap-3">
              {processed.length ? (
                processed.map((bin) => <DirectResaleBinRow bin={bin} key={bin.id} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                  No processed bins yet.
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Showing {processed.length} of {processed.length} records
          </p>
        </section>
      </div>
    </div>
  )
}
