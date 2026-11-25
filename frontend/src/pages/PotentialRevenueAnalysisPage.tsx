import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { directResaleBins } from '@/lib/mock-direct-resale-bins'

export function PotentialRevenueAnalysisPage() {
  const processed = directResaleBins.filter((bin) => bin.status === 'Processed')
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total potential revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-4xl font-semibold tracking-tight text-primary">
            ฿{totalRevenue.toLocaleString('en-US')}
          </p>
          <p className="text-sm text-muted-foreground">{processed.length} processed bins</p>
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
