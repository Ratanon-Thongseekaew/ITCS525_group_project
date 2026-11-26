import { useCallback, useState } from 'react'
import { Archive, Calculator, Check, ClipboardList, Shirt, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getDirectResaleBins, processDirectResaleBin, type DirectResaleBinRecord } from '@/api'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApiResource } from '@/lib/use-api-resource'
import { useHandoffWorkspace } from '@/lib/use-handoff-workspace'

const metrics = [
  { label: 'Bins Awaiting', value: (awaiting: DirectResaleBinRecord[]) => awaiting.length },
  {
    label: 'Items Staged',
    value: (awaiting: DirectResaleBinRecord[]) =>
      awaiting.reduce((sum, bin) => sum + bin.item_count, 0),
  },
  {
    label: 'Total Grossed Weight',
    value: (awaiting: DirectResaleBinRecord[]) =>
      `${awaiting.reduce((sum, bin) => sum + bin.total_weight_kg, 0)} kg`,
  },
]

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function DirectResalePage() {
  const workspace = useHandoffWorkspace()
  const { siteId, actor } = workspace
  const loadBins = useCallback(
    (signal: AbortSignal) => getDirectResaleBins(siteId!, signal),
    [siteId],
  )
  const resource = useApiResource(
    siteId === null ? null : `direct-resale:${siteId}`,
    loadBins,
    'Direct resale bins could not be loaded.',
  )
  const bins = resource.data ?? []
  const awaiting = bins.filter((bin) => bin.status === 'awaiting_process')
  const processed = bins.filter((bin) => bin.status === 'processed')
  const [activeBin, setActiveBin] = useState<DirectResaleBinRecord | null>(null)
  const [accepted, setAccepted] = useState('')
  const [rejected, setRejected] = useState('0')
  const [revenue, setRevenue] = useState('')
  const [processDate, setProcessDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  function openProcess(bin: DirectResaleBinRecord) {
    setActiveBin(bin)
    setAccepted(String(bin.item_count))
    setRejected('0')
    setRevenue('')
    setProcessDate(today())
    setNotes('')
    setKeypadOpen(false)
  }

  async function confirmProcess() {
    if (!activeBin || !actor) return
    setIsSaving(true)
    try {
      await processDirectResaleBin(activeBin.id, {
        actor_id: actor.id,
        accepted_item_count: Number(accepted),
        rejected_item_count: Number(rejected),
        revenue: Number(revenue),
        processed_at: processDate,
        notes: notes.trim() || undefined,
      })
      resource.retry()
      setActiveBin(null)
      toast.success('Resale bin processed and saved.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save resale bin processing.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-white text-slate-900">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-12 lg:py-10">
        <nav className="text-xs text-slate-500 sm:text-sm" aria-label="Breadcrumb">
          Operations <span className="mx-2 text-slate-300">/</span>
          <strong className="font-semibold text-slate-900">Direct Resale</strong>
        </nav>

        <header className="mt-6 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:mt-8 sm:pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Direct Resale Bins
            </h1>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Review closed resale bins, record accepted items and sale revenue.
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button asChild variant="outline" className="h-11 justify-start rounded-xl text-sm">
              <Link to="/staff/direct-resale/potential-revenue-analysis">
                <ClipboardList /> Revenue Summary
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 justify-start rounded-xl text-sm">
              <Link to="/staff/direct-resale/processed-bins-record">
                <Archive /> Processed Bin History
              </Link>
            </Button>
          </div>
        </header>

        <div className="mt-5">
          <HandoffActorBar workspace={workspace} />
        </div>

        <section className="mt-7" aria-labelledby="resale-summary-title">
          <h2 id="resale-summary-title" className="mb-4 text-base font-semibold">
            Summary
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 p-4 sm:min-h-40 sm:p-6"
              >
                <span className="text-xs text-slate-500 sm:text-sm">{metric.label}</span>
                <strong className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {metric.value(awaiting)}
                </strong>
              </article>
            ))}
            <article className="flex min-h-32 flex-col justify-between rounded-2xl border border-slate-200 p-4 sm:min-h-40 sm:p-6">
              <span className="text-xs text-slate-500 sm:text-sm">Bins Processed</span>
              <strong className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {processed.length}
              </strong>
            </article>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="awaiting-bins-title">
          <h2 id="awaiting-bins-title" className="mb-4 text-base font-semibold">
            Bins awaiting process
          </h2>
          {siteId === null ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Choose a staff account above to load resale bins for its site.
            </p>
          ) : resource.isLoading ? (
            <p className="p-6 text-sm text-slate-500" role="status">
              Loading resale bins…
            </p>
          ) : resource.error ? (
            <div
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
              role="alert"
            >
              <span>{resource.error}</span>
              <Button variant="outline" onClick={resource.retry}>
                Retry
              </Button>
            </div>
          ) : awaiting.length ? (
            <div className="grid gap-3">
              {awaiting.map((bin) => (
                <DirectResaleBinRow bin={bin} key={bin.id} onSelect={() => openProcess(bin)} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
              No closed resale bins are waiting to be processed.
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">Showing {awaiting.length} records</p>
        </section>
      </div>

      {activeBin && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-2 sm:p-6"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setActiveBin(null)}
        >
          <section
            className="max-h-[96vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-2xl sm:max-h-[92vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="process-title"
          >
            <header className="flex items-center justify-between px-5 py-5 sm:px-9 sm:py-7">
              <h2 id="process-title" className="text-lg font-semibold">
                Process Resale Bin
              </h2>
              <button
                className="grid size-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Close"
                onClick={() => setActiveBin(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="px-5 pb-6 sm:px-9 sm:pb-9">
              <div className="grid grid-cols-[32px_1fr_1fr] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[48px_1fr_150px_150px] sm:gap-4 sm:p-6">
                <Shirt className="size-6 text-teal-700" />
                <div className="col-span-2 grid gap-1 sm:col-span-1">
                  <strong className="text-lg">#{activeBin.bin_code}</strong>
                  <b className="text-sm font-medium text-teal-700">Resale Bin</b>
                </div>
                <div className="grid gap-1">
                  <small className="text-xs text-slate-500">Item Count</small>
                  <strong className="text-sm">{activeBin.item_count} items</strong>
                </div>
                <div className="grid gap-1">
                  <small className="text-xs text-slate-500">Grossed Weight</small>
                  <strong className="text-sm">{activeBin.total_weight_kg}kg</strong>
                </div>
                <p className="col-span-full mt-1 text-xs text-slate-500">
                  Packed at&nbsp; {new Date(activeBin.packed_at).toLocaleString()}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.9fr_0.8fr]">
                <label className="grid content-start gap-2 text-sm font-medium">
                  Accepted Item Count
                  <Input
                    className="h-12 rounded-xl text-base"
                    type="number"
                    min="0"
                    value={accepted}
                    onChange={(event) => setAccepted(event.target.value)}
                  />
                </label>
                <label className="grid content-start gap-2 text-sm font-medium">
                  Rejected Item Count
                  <Input
                    className="h-12 rounded-xl border-orange-500 text-base"
                    type="number"
                    min="0"
                    value={rejected}
                    onChange={(event) => setRejected(event.target.value)}
                  />
                </label>
                <label className="grid content-start gap-2 text-sm font-medium">
                  Sale Revenue (฿)
                  <Input
                    className="h-12 rounded-xl text-base"
                    type="number"
                    min="0"
                    step="0.01"
                    value={revenue}
                    onChange={(event) => setRevenue(event.target.value)}
                  />
                </label>
                <label className="grid content-start gap-2 text-sm font-medium">
                  Quick Amount Keypad
                  <Button
                    className="h-12 rounded-xl"
                    variant="secondary"
                    onClick={() => setKeypadOpen(!keypadOpen)}
                  >
                    <Calculator /> {keypadOpen ? 'Close' : 'Open'}
                  </Button>
                </label>
                {keypadOpen && (
                  <div
                    className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 p-2 sm:col-span-2"
                    aria-label="Quick amount keypad"
                  >
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '00'].map((key) => (
                      <button
                        className="min-h-9 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                        key={key}
                        type="button"
                        onClick={() =>
                          key === 'C'
                            ? setRevenue('')
                            : setRevenue((current) => `${current === '0' ? '' : current}${key}`)
                        }
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                )}
                <label className="grid content-start gap-2 text-sm font-medium">
                  Process Date
                  <Input
                    className="h-12 rounded-xl text-base"
                    type="date"
                    value={processDate}
                    onChange={(event) => setProcessDate(event.target.value)}
                  />
                </label>
                <label className="grid content-start gap-2 text-sm font-medium lg:col-span-2">
                  Notes <span className="font-normal text-slate-500">(Optional)</span>
                  <textarea
                    className="min-h-12 resize-y rounded-xl border border-slate-200 p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Accepted and rejected item counts must total {activeBin.item_count} items.
              </p>
            </div>

            <footer className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-9 sm:py-6">
              <Button
                className="h-12 w-full rounded-xl bg-teal-700 text-base hover:bg-teal-800"
                disabled={
                  isSaving ||
                  !revenue ||
                  Number(revenue) < 0 ||
                  Number(accepted) + Number(rejected) !== activeBin.item_count ||
                  !processDate
                }
                onClick={confirmProcess}
              >
                <Check /> {isSaving ? 'Saving…' : 'Confirm'}
              </Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
