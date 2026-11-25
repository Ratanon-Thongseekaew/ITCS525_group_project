import { useEffect, useState } from 'react'
import { Database, TrendingDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import {
  getDashboard,
  type DashboardException,
  type DashboardFrequency,
  type DashboardOutcome,
  type DashboardResponse,
} from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { EprReportExportDialog } from '@/components/EprReportExportDialog'
import { EprReportManagementDialog } from '@/components/EprReportManagementDialog'
import { FilterSelect, type FilterOption } from '@/components/FilterSelect'
import { ErrorState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { PageSection } from '@/components/PageSection'
import { StatCard, type StatCardTone } from '@/components/StatCard'
import { TableCard } from '@/components/TableCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OUTCOME_CATEGORIES, OUTCOME_TONES } from '@/lib/outcome-tones'
import { cn } from '@/lib/utils'

interface SummaryMetric {
  label: string
  value: string
  detail: string
  tone?: StatCardTone
  trend?: 'down'
}

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)),
}))

const quarterOptions = [1, 2, 3, 4].map((quarter) => ({
  value: String(quarter),
  label: `Quarter ${quarter}`,
}))

const frequencyOptions: FilterOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

const chartConfig = Object.fromEntries(
  OUTCOME_CATEGORIES.map((category) => [
    category,
    { label: OUTCOME_TONES[category].label, color: OUTCOME_TONES[category].chartColor },
  ]),
) satisfies ChartConfig

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function getInitialPeriod() {
  const now = new Date()
  const lastCompletedMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return {
    year: lastCompletedMonth.getFullYear(),
    month: lastCompletedMonth.getMonth() + 1,
    quarter: Math.floor(lastCompletedMonth.getMonth() / 3) + 1,
  }
}

function formatWeight(value: number) {
  return `${numberFormatter.format(value)} kg`
}

function buildSummaryMetrics(data: DashboardResponse): SummaryMetric[] {
  const { summary } = data
  const variancePrefix = summary.weight_variance_kg > 0 ? '+' : ''
  return [
    {
      label: 'Recycling Bins Collected',
      value: numberFormatter.format(summary.recycling_bins_collected),
      detail: `${data.filters.contractors.length} active contractors`,
    },
    {
      label: 'Recycling Bins Reported',
      value: numberFormatter.format(summary.recycling_bins_reported),
      detail: `${summary.pending_bins} bin${summary.pending_bins === 1 ? '' : 's'} pending`,
    },
    {
      label: 'Disputed Handoffs',
      value: numberFormatter.format(summary.disputed_handoffs),
      detail: 'Requiring manager review',
      tone: summary.disputed_handoffs ? 'warning' : 'default',
    },
    {
      label: 'Diverted from Landfill',
      value: `${numberFormatter.format(summary.recovery_rate)}%`,
      detail: `${formatWeight(summary.diverted_weight_kg)} diverted`,
      tone: 'success',
    },
    {
      label: 'Total Weight Recorded',
      value: formatWeight(summary.total_recorded_weight_kg),
      detail: 'Center staff pickup weight',
    },
    {
      label: 'Total Weight Reported',
      value: formatWeight(summary.total_reported_weight_kg),
      detail: `${variancePrefix}${formatWeight(summary.weight_variance_kg)} variance`,
      trend: summary.weight_variance_kg < 0 ? 'down' : undefined,
    },
  ]
}

function OutcomeDonut({
  outcomes,
  recoveryRate,
}: {
  outcomes: DashboardOutcome[]
  recoveryRate: number
}) {
  const chartData = outcomes.map((outcome) => ({
    ...outcome,
    fill: `var(--color-${outcome.category})`,
  }))
  const hasOutcomes = outcomes.some((outcome) => outcome.weight_kg > 0)

  return (
    <Card className="h-full">
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-sm">End-of-life Breakdown by Outcome Category</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {hasOutcomes ? (
          <div className="relative mx-auto w-full max-w-[480px]">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <PieChart accessibilityLayer>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={chartData}
                  dataKey="weight_kg"
                  nameKey="category"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={1}
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-2xs" />}
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-x-0 top-[94px] text-center">
              <strong className="block text-2xl tracking-tight text-foreground">
                {numberFormatter.format(recoveryRate)}%
              </strong>
              <span className="text-2xs text-muted-foreground">Recovery</span>
            </div>
          </div>
        ) : (
          <EmptyState className="h-[280px]">No contractor outcomes for this period.</EmptyState>
        )}
      </CardContent>
    </Card>
  )
}

function MonthlyOutcomeChart({
  data,
  year,
}: {
  data: DashboardResponse['monthly_outcomes']
  year: number
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 p-4 pb-1">
        <CardTitle className="text-sm">Contractor Outcomes in {year}</CardTitle>
        <p className="text-right text-2xs text-muted-foreground">Annual monthly trend</p>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 sm:pt-2">
        {data.length ? (
          <div className="overflow-x-auto">
            <ChartContainer config={chartConfig} className="h-[320px] w-full min-w-[700px]">
              <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 8, left: -12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month_label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend
                  content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-2xs" />}
                />
                {OUTCOME_CATEGORIES.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="outcome"
                    fill={`var(--color-${category})`}
                    radius={index === OUTCOME_CATEGORIES.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <EmptyState>No monthly outcome data is available for {year}.</EmptyState>
        )}
      </CardContent>
    </Card>
  )
}

function ExceptionTable({ exceptions }: { exceptions: DashboardException[] }) {
  if (!exceptions.length) {
    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Pending and Disputed Handoffs</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <EmptyState>No pending or disputed handoffs for this period.</EmptyState>
        </CardContent>
      </Card>
    )
  }

  return (
    <TableCard
      title="Pending and Disputed Handoffs"
      actions={<span className="text-2xs text-muted-foreground">Exceptions</span>}
      footer={`Showing ${exceptions.length} exception${exceptions.length === 1 ? '' : 's'}`}
    >
      <Table className="min-w-[900px] text-xs">
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="px-4">Bin ID</TableHead>
            <TableHead className="px-4">Contractor</TableHead>
            <TableHead className="px-4">Handoff Date</TableHead>
            <TableHead className="px-4">Items</TableHead>
            <TableHead className="px-4">Staff Weight</TableHead>
            <TableHead className="px-4">Driver Weight</TableHead>
            <TableHead className="px-4">Variance</TableHead>
            <TableHead className="px-4">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exceptions.map((exception) => (
            <TableRow key={exception.handoff_id} className="text-muted-foreground">
              <TableCell className="px-4 py-3 font-medium text-foreground">
                {exception.bin_code}
              </TableCell>
              <TableCell className="px-4 py-3">{exception.contractor_name}</TableCell>
              <TableCell className="px-4 py-3">
                {dateFormatter.format(new Date(exception.handoff_date))}
              </TableCell>
              <TableCell className="px-4 py-3">
                {numberFormatter.format(exception.item_count)}
              </TableCell>
              <TableCell className="px-4 py-3">{formatWeight(exception.staff_weight_kg)}</TableCell>
              <TableCell className="px-4 py-3">
                {formatWeight(exception.driver_weight_kg)}
              </TableCell>
              <TableCell
                className={cn('px-4 py-3', exception.status === 'disputed' && 'text-destructive')}
              >
                {numberFormatter.format(exception.variance_percent)}%
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge variant={exception.status === 'pending' ? 'warning' : 'destructive'}>
                  {exception.status === 'pending' ? 'Pending report' : 'Disputed'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}

function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard" role="status" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <Skeleton className="h-52" />
    </div>
  )
}

export function ComplianceDashboardPage() {
  const [initialPeriod] = useState(getInitialPeriod)
  const [frequency, setFrequency] = useState<DashboardFrequency>('monthly')
  const [year, setYear] = useState(initialPeriod.year)
  const [month, setMonth] = useState(initialPeriod.month)
  const [quarter, setQuarter] = useState(initialPeriod.quarter)
  const [siteId, setSiteId] = useState('all')
  const [contractorId, setContractorId] = useState('all')
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void getDashboard(
      {
        frequency,
        year,
        month: frequency === 'monthly' ? month : undefined,
        quarter: frequency === 'quarterly' ? quarter : undefined,
        site_id: siteId === 'all' ? undefined : Number(siteId),
        contractor_id: contractorId === 'all' ? undefined : Number(contractorId),
      },
      controller.signal,
    )
      .then((response) => {
        setDashboard(response)
        setError(null)
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [contractorId, frequency, month, quarter, retryCount, siteId, year])

  function updateFilter(update: () => void) {
    setIsLoading(true)
    setError(null)
    update()
  }

  function retryDashboard() {
    setIsLoading(true)
    setError(null)
    setRetryCount((count) => count + 1)
  }

  const summaryMetrics = dashboard ? buildSummaryMetrics(dashboard) : []
  const yearOptions = (dashboard?.filters.available_years ?? [year]).map((availableYear) => ({
    value: String(availableYear),
    label: String(availableYear),
  }))
  const siteOptions = [
    { value: 'all', label: 'All Sites' },
    ...(dashboard?.filters.sites.map((site) => ({ value: String(site.id), label: site.name })) ??
      []),
  ]
  const contractorOptions = [
    { value: 'all', label: 'All Contractors' },
    ...(dashboard?.filters.contractors.map((contractor) => ({
      value: String(contractor.id),
      label: contractor.name,
    })) ?? []),
  ]

  const eprDialogProps = {
    defaultYear: year,
    defaultQuarter: frequency === 'monthly' ? Math.ceil(month / 3) : quarter,
    years: dashboard?.filters.available_years ?? [year],
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: 'Operations' }, { label: 'Compliance' }]}
        title="Compliance Dashboard"
        description="Live handoff and contractor outcome data from Textile Track"
        actions={
          <>
            <EprReportManagementDialog {...eprDialogProps} />
            <EprReportExportDialog {...eprDialogProps} />
          </>
        }
      />

      <PageSection
        title="Dashboard Filters"
        description="Adjust the site, reporting period, and contractor."
        bordered
        actions={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect
              label="Site"
              value={siteId}
              className="sm:w-48"
              items={siteOptions}
              onValueChange={(value) => updateFilter(() => setSiteId(value))}
            />
            <FilterSelect
              label="Reporting frequency"
              value={frequency}
              className="sm:w-32"
              items={frequencyOptions}
              onValueChange={(value) =>
                updateFilter(() => setFrequency(value as DashboardFrequency))
              }
            />
            <FilterSelect
              label="Reporting year"
              value={String(year)}
              className="sm:w-24"
              items={yearOptions}
              onValueChange={(value) => updateFilter(() => setYear(Number(value)))}
            />
            {frequency === 'monthly' ? (
              <FilterSelect
                label="Reporting month"
                value={String(month)}
                className="sm:w-28"
                items={monthOptions}
                onValueChange={(value) => updateFilter(() => setMonth(Number(value)))}
              />
            ) : null}
            {frequency === 'quarterly' ? (
              <FilterSelect
                label="Reporting quarter"
                value={String(quarter)}
                className="sm:w-32"
                items={quarterOptions}
                onValueChange={(value) => updateFilter(() => setQuarter(Number(value)))}
              />
            ) : null}
            <FilterSelect
              label="Contractor"
              value={contractorId}
              className="sm:w-52"
              items={contractorOptions}
              onValueChange={(value) => updateFilter(() => setContractorId(value))}
            />
          </div>
        }
      />

      {error ? (
        <ErrorState
          message={`Dashboard data could not be loaded. ${error}`}
          onRetry={retryDashboard}
        />
      ) : null}

      {isLoading && !dashboard ? <DashboardLoading /> : null}

      {dashboard ? (
        <div className={cn('flex flex-col gap-6 transition-opacity', isLoading && 'opacity-60')}>
          <PageSection
            title="Period overview"
            actions={
              <span className="text-2xs text-muted-foreground">{dashboard.period_label}</span>
            }
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {summaryMetrics.map((metric) => (
                  <StatCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    hint={metric.detail}
                    tone={metric.tone}
                    footer={
                      metric.trend === 'down' ? (
                        <TrendingDown
                          className="size-4 shrink-0 text-destructive"
                          aria-label="Below recorded weight"
                        />
                      ) : null
                    }
                  />
                ))}
              </dl>
              <OutcomeDonut
                outcomes={dashboard.outcomes}
                recoveryRate={dashboard.summary.recovery_rate}
              />
            </div>
          </PageSection>

          <MonthlyOutcomeChart data={dashboard.monthly_outcomes} year={dashboard.year} />
          <ExceptionTable exceptions={dashboard.exceptions} />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="size-4 text-primary" aria-hidden="true" />
            <span>Live data from the Textile Track database.</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
