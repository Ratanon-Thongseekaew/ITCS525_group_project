import { Store } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getResaleStoreSummary, type ResaleStoreSummary } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import Converge, { type DataSourceItem } from '@/lib/react-vibe/Converage'

const STORE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]
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
    <section className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Direct Resale' }]}
        title="Resale Bin Records"
        description="Actual resale value from the first five stores."
      />

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading resale store data"
          className="flex min-h-80 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground"
        >
          Loading resale store data...
        </div>
      ) : null}

      {error ? <ErrorState message={error} onRetry={retryRequest} /> : null}

      {!isLoading && !error && stores.length > 0 ? (
        <Converge
          CurveRadius={250}
          CurveWeight={1.5}
          CurcePillColor="var(--primary)"
          PillSpeed={3.5}
          PillWeight={2.5}
          PillLength={14}
          PillRadius={1}
          dataSources={stores}
        />
      ) : null}

      {!isLoading && !error && stores.length === 0 ? (
        <EmptyState>No resale store data is available.</EmptyState>
      ) : null}
    </section>
  )
}

export default ResaleBinRecords
