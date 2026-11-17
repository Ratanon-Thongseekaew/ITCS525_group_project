import { AlertCircle, RefreshCw, Store } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getResaleStoreSummary, type ResaleStoreSummary } from '@/api'
import Converge, { type DataSourceItem } from '@/lib/react-vibe/Converage'

const STORE_COLORS = ['#10a37f', '#d97757', '#8ab4f8', '#4d6bfe', '#999784']
const STORE_POSITIONS = [120, 210, 300, 390, 480]

function toDataSources(stores: ResaleStoreSummary[]): DataSourceItem[] {
  return stores.slice(0, 5).map((store, index) => ({
    id: store.id,
    name: store.name,
    actualValue: store.actual_value,
    color: STORE_COLORS[index],
    y: STORE_POSITIONS[index],
    icon: <Store size={25} aria-hidden="true" />,
  }))
}

function ResaleBinRecords() {
  const [stores, setStores] = useState<DataSourceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getResaleStoreSummary(controller.signal)
      .then((response) => setStores(toDataSources(response.stores)))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Resale store data could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [retryCount])

  function retryRequest() {
    setIsLoading(true)
    setError(null)
    setRetryCount((count) => count + 1)
  }

  return (
    <section className="space-y-5" aria-labelledby="resale-bin-records-title">
      <header>
        <p className="mb-1 text-xs font-medium text-emerald-700">Operations / Direct Resale</p>
        <h1
          id="resale-bin-records-title"
          className="mb-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
        >
          Resale Bin Records
        </h1>
        <p className="mb-0 text-sm text-slate-500">
          Actual resale value from the first five stores.
        </p>
      </header>

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading resale store data"
          className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500"
        >
          Loading resale store data...
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-800"
        >
          <AlertCircle aria-hidden="true" />
          <p className="mb-0">{error}</p>
          <button
            type="button"
            onClick={retryRequest}
            className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-white px-3 py-2 font-medium hover:bg-rose-100"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && stores.length > 0 ? (
        <Converge
          CurveRadius={250}
          CurveWeight={1.5}
          CurcePillColor="#10b981"
          PillSpeed={3.5}
          PillWeight={2.5}
          PillLength={14}
          PillRadius={1}
          dataSources={stores}
        />
      ) : null}

      {!isLoading && !error && stores.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No resale store data is available.
        </p>
      ) : null}
    </section>
  )
}

export default ResaleBinRecords
