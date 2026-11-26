import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { getDirectResaleBins } from '@/api'
import { PageHeader } from '@/components/PageHeader'
import { HandoffActorBar } from '@/components/staff/HandoffActorBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
    <section className="flex flex-col gap-7">
      <PageHeader
        breadcrumbs={[
          { label: 'Operations' },
          { label: 'Direct Resale', to: '/staff/direct-resale' },
          { label: 'Potential Revenue Analysis' },
        ]}
        title="Potential Revenue Analysis"
        description="Revenue recorded from processed direct resale bins"
      />
      <HandoffActorBar workspace={workspace} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total recorded revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {siteId === null ? (
            <p className="text-sm text-muted-foreground">
              Choose a staff account to see its site revenue.
            </p>
          ) : resource.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">
              Loading revenue…
            </p>
          ) : resource.error ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{resource.error}</p>
              <Button variant="outline" onClick={resource.retry}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <p className="text-4xl font-semibold tracking-tight text-primary">
                ฿{totalRevenue.toLocaleString('en-US')}
              </p>
              <p className="text-sm text-muted-foreground">{processed.length} processed bins</p>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link to="/staff/direct-resale">
              <ArrowLeft aria-hidden="true" /> Back to bins
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}
