import { useState } from 'react'
import { Archive, ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { StatCard } from '@/components/StatCard'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { DirectResaleProcessDialog } from '@/components/staff/DirectResaleProcessDialog'
import { Button } from '@/components/ui/button'
import { directResaleBins, type DirectResaleBin } from '@/lib/mock-direct-resale-bins'

export function DirectResalePage() {
  const [bins, setBins] = useState(directResaleBins)
  const [activeBin, setActiveBin] = useState<DirectResaleBin | null>(null)

  const awaiting = bins.filter((bin) => bin.status === 'Awaiting Process')
  const processed = bins.filter((bin) => bin.status === 'Processed')

  function confirmProcess(revenue: number) {
    if (!activeBin) return
    setBins((current) =>
      current.map((bin) =>
        bin.id === activeBin.id ? { ...bin, status: 'Processed', revenue } : bin,
      ),
    )
    setActiveBin(null)
  }

  return (
    <section className="flex flex-col gap-7">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Direct Resale' }]}
        title="Direct Resale Bins"
        description="Tap to process resale bin and record potential revenue"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/staff/direct-resale/potential-revenue-analysis">
                <ClipboardList aria-hidden="true" /> Potential Revenue Analysis
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

      <PageSection title="Summary" bordered>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Bins Awaiting" value={awaiting.length} />
          <StatCard
            label="Items Staged"
            value={awaiting.reduce((sum, bin) => sum + bin.count, 0)}
          />
          <StatCard
            label="Total Grossed Weight"
            value={`${awaiting.reduce((sum, bin) => sum + bin.weight, 0)} kg`}
          />
          <StatCard label="Bins Processed Today" value={processed.length + 3} />
        </dl>
      </PageSection>

      <PageSection
        title="Bins awaiting process"
        footer={`Showing ${awaiting.length} of ${awaiting.length} records`}
      >
        {awaiting.length ? (
          <ul aria-label="Bins awaiting process" className="flex flex-col gap-4">
            {awaiting.map((bin) => (
              <li key={bin.id}>
                <DirectResaleBinRow bin={bin} onSelect={() => setActiveBin(bin)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No bins in this list.</EmptyState>
        )}
      </PageSection>

      {activeBin ? (
        <DirectResaleProcessDialog
          key={activeBin.id}
          bin={activeBin}
          onClose={() => setActiveBin(null)}
          onConfirm={confirmProcess}
        />
      ) : null}
    </section>
  )
}
