import { useState } from 'react'
import { Archive, Calculator, Check, ClipboardList, Shirt, X } from 'lucide-react'
import { Link } from 'react-router'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { directResaleBins, type DirectResaleBin } from '@/lib/mock-direct-resale-bins'

const metrics = [
  { label: 'Bins Awaiting', value: (awaiting: DirectResaleBin[]) => awaiting.length },
  {
    label: 'Items Staged',
    value: (awaiting: DirectResaleBin[]) => awaiting.reduce((sum, bin) => sum + bin.count, 0),
  },
  {
    label: 'Total Grossed Weight',
    value: (awaiting: DirectResaleBin[]) =>
      `${awaiting.reduce((sum, bin) => sum + bin.weight, 0)} kg`,
  },
]

export function DirectResalePage() {
  const [bins, setBins] = useState(directResaleBins)
  const [activeBin, setActiveBin] = useState<DirectResaleBin | null>(null)
  const [accepted, setAccepted] = useState('98')
  const [rejected, setRejected] = useState('2')
  const [revenue, setRevenue] = useState('15000')
  const [notes, setNotes] = useState('')
  const [keypadOpen, setKeypadOpen] = useState(false)

  const awaiting = bins.filter((bin) => bin.status === 'Awaiting Process')
  const processed = bins.filter((bin) => bin.status === 'Processed')

  function openProcess(bin: DirectResaleBin) {
    setActiveBin(bin)
    setAccepted(String(bin.count - 2))
    setRejected('2')
    setRevenue('15000')
    setNotes('')
  }

  function confirmProcess() {
    if (!activeBin) return
    setBins((current) =>
      current.map((bin) =>
        bin.id === activeBin.id ? { ...bin, status: 'Processed', revenue: Number(revenue) } : bin,
      ),
    )
    setActiveBin(null)
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
              Tap to process resale bin and record potential revenue
            </p>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Button asChild variant="outline" className="h-11 justify-start rounded-xl text-sm">
              <Link to="/staff/direct-resale/potential-revenue-analysis">
                <ClipboardList /> Potential Revenue Analysis
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 justify-start rounded-xl text-sm">
              <Link to="/staff/direct-resale/processed-bins-record">
                <Archive /> Processed Bin Records
              </Link>
            </Button>
          </div>
        </header>

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
              <span className="text-xs text-slate-500 sm:text-sm">Bins Processed Today</span>
              <strong className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {processed.length + 3}
              </strong>
            </article>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="awaiting-bins-title">
          <h2 id="awaiting-bins-title" className="mb-4 text-base font-semibold">
            Bins awaiting process
          </h2>
          <div className="grid gap-3">
            {awaiting.length ? (
              awaiting.map((bin) => (
                <DirectResaleBinRow bin={bin} key={bin.id} onSelect={() => openProcess(bin)} />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                No bins in this list.
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Showing {awaiting.length} of {awaiting.length} records
          </p>
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
                  <strong className="text-lg">#{activeBin.id}</strong>
                  <b className="text-sm font-medium text-teal-700">Resale Bin</b>
                </div>
                <div className="grid gap-1">
                  <small className="text-xs text-slate-500">Item Count</small>
                  <strong className="text-sm">{activeBin.count} items</strong>
                </div>
                <div className="grid gap-1">
                  <small className="text-xs text-slate-500">Grossed Weight</small>
                  <strong className="text-sm">{activeBin.weight}kg</strong>
                </div>
                <p className="col-span-full mt-1 text-xs text-slate-500">
                  Packed at&nbsp; {activeBin.packed}
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
                  Potential Revenue
                  <div className="relative">
                    <Input
                      className="h-12 rounded-xl pr-10 text-base"
                      type="number"
                      min="0"
                      value={revenue}
                      onChange={(event) => setRevenue(event.target.value)}
                    />
                    <span className="absolute inset-y-0 right-3 grid place-items-center text-slate-500">
                      ฿
                    </span>
                  </div>
                </label>
                <label className="grid content-start gap-2 text-sm font-medium">
                  Or Use Running-Sum Keypad
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
                    aria-label="Running-sum keypad"
                  >
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '+'].map((key) => (
                      <button
                        className="min-h-9 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100"
                        key={key}
                        type="button"
                        onClick={() =>
                          key === 'C'
                            ? setRevenue('0')
                            : key === '+'
                              ? undefined
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
                    defaultValue="2026-10-20"
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
                Accepted and rejected item counts should total {activeBin.count} items.
              </p>
            </div>

            <footer className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-9 sm:py-6">
              <Button
                className="h-12 w-full rounded-xl bg-teal-700 text-base hover:bg-teal-800"
                disabled={Number(accepted) + Number(rejected) !== activeBin.count}
                onClick={confirmProcess}
              >
                <Check /> Confirm
              </Button>
            </footer>
          </section>
        </div>
      )}
    </div>
  )
}
