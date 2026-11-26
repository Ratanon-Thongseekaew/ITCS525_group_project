import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getDirectResaleBins } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
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
    <section className="flex flex-col gap-7">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Direct Resale', to: '/staff/direct-resale' },
          { label: 'Processed Bin Records' },
        ]}
        title="Processed Bin Records"
        description="Direct resale bins that have been processed and had revenue recorded"
        actions={
          <Button asChild variant="outline">
            <Link to="/staff/direct-resale">
              <ArrowLeft aria-hidden="true" /> Back to bins
            </Link>
          </Button>
        }
      />
      <HandoffActorBar workspace={workspace} />

      <PageSection
        title="Processed bin records"
        footer={`Showing ${processed.length} of ${processed.length} records`}
      >
        {siteId === null ? (
          <EmptyState>Choose a staff account above to see its processed bins.</EmptyState>
        ) : resource.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground" role="status">
            Loading processed bins…
          </p>
        ) : resource.error ? (
          <div className="flex items-center justify-between gap-3" role="alert">
            <p className="text-sm text-destructive">{resource.error}</p>
            <Button variant="outline" onClick={resource.retry}>
              Retry
            </Button>
          </div>
        ) : processed.length ? (
          <ul aria-label="Processed bin records" className="flex flex-col gap-4">
            {processed.map((bin) => (
              <li key={bin.id}>
                <DirectResaleBinRow bin={bin} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>No processed bins yet.</EmptyState>
        )}
      </PageSection>
    </section>
  )
}
