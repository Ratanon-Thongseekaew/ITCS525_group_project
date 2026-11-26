import { useCallback, useState } from 'react'
import { Archive, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { getDirectResaleBins, type DirectResaleBinRecord } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { StatCard } from '@/components/StatCard'
import { DirectResaleAccountBar } from '@/components/staff/DirectResaleAccountBar'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { DirectResaleProcessDialog } from '@/components/staff/DirectResaleProcessDialog'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth-session'
import { useApiResource } from '@/lib/use-api-resource'

export function DirectResalePage() {
  const user = useSession()?.user ?? null
  const actor = user?.role === 'staff' ? user : null
  const siteId = actor?.store?.id ?? null
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

  return (
    <section className="flex flex-col gap-7">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Direct Resale' }]}
        title="Direct Resale Bins"
        description="Review closed resale bins, record accepted items and sale revenue."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale/potential-revenue-analysis">
                <ClipboardList aria-hidden="true" /> Revenue Summary
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale/processed-bins-record">
                <Archive aria-hidden="true" /> Processed Bin Records
              </Link>
            </Button>
          </>
        }
      />

      <DirectResaleAccountBar user={user} />

      <PageSection title="Summary" bordered>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Bins Awaiting" value={awaiting.length} />
          <StatCard
            label="Items Staged"
            value={awaiting.reduce((sum, bin) => sum + bin.item_count, 0)}
          />
          <StatCard
            label="Total Grossed Weight"
            value={`${awaiting.reduce((sum, bin) => sum + bin.total_weight_kg, 0)} kg`}
          />
          <StatCard label="Bins Processed" value={processed.length} />
        </dl>
      </PageSection>

      <PageSection title="Bins awaiting process" footer={`Showing ${awaiting.length} records`}>
        {siteId === null ? (
          <EmptyState>
            A staff account assigned to a store is required to load resale bins.
          </EmptyState>
        ) : resource.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground" role="status">
            Loading resale bins…
          </p>
        ) : resource.error ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            <span>{resource.error}</span>
            <Button variant="outline" onClick={resource.retry}>
              Retry
            </Button>
          </div>
        ) : awaiting.length ? (
          <ul aria-label="Bins awaiting process" className="flex flex-col gap-4">
            {awaiting.map((bin) => (
              <li key={bin.id}>
                <DirectResaleBinRow bin={bin} onSelect={() => setActiveBin(bin)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No closed resale bins are waiting to be processed.</EmptyState>
        )}
      </PageSection>

      {activeBin && actor ? (
        <DirectResaleProcessDialog
          key={activeBin.id}
          bin={activeBin}
          actorId={actor.id}
          onClose={() => setActiveBin(null)}
          onProcessed={() => {
            setActiveBin(null)
            resource.retry()
          }}
        />
      ) : null}
    </section>
  )
}
