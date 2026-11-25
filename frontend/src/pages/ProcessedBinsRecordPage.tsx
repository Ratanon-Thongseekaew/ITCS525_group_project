import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { DirectResaleBinRow } from '@/components/staff/DirectResaleBinRow'
import { Button } from '@/components/ui/button'
import { directResaleBins } from '@/lib/mock-direct-resale-bins'

export function ProcessedBinsRecordPage() {
  const processed = directResaleBins.filter((bin) => bin.status === 'Processed')

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

      <PageSection
        title="Processed bin records"
        footer={`Showing ${processed.length} of ${processed.length} records`}
      >
        {processed.length ? (
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
