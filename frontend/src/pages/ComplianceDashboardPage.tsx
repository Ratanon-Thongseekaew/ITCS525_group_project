import { useEffect, useState } from 'react'
import { AlertCircle, Database, Download, RefreshCw, TrendingDown } from 'lucide-react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

import {
  getDashboard,
  type DashboardException,
  type DashboardFrequency,
  type DashboardOutcome,
  type DashboardResponse,
} from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SummaryMetric {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'success' | 'warning'
  trend?: 'down'
}

interface SelectOption {
  value: string
  label: string
}

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1)),
}))

const quarterOptions = [1, 2, 3, 4].map((quarter) => ({
  value: String(quarter),
  label: `Quarter ${quarter}`,
}))

const frequencyOptions: SelectOption[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

const chartConfig = {
  upcycled: { label: 'Upcycled', color: '#0f8f83' },
  fibre_to_fibre: { label: 'Fibre-to-fibre', color: '#3b82f6' },
  downcycled: { label: 'Downcycled', color: '#1e3a8a' },
  exported: { label: 'Exported', color: '#f59e0b' },
  landfilled: { label: 'Landfilled', color: '#64748b' },
  incinerated_energy_recovery: {
    label: 'Incinerated with energy recovery',
    color: '#e11d48',
  },
} satisfies ChartConfig

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

function MetricCard({ metric }: { metric: SummaryMetric }) {
  return (
    <Card className="min-w-0 rounded-lg shadow-none">
      <CardContent className="p-4">
        <p className="mb-2 text-xs font-medium text-slate-600">{metric.label}</p>
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'mb-0 truncate text-xl font-semibold tracking-tight text-slate-950',
              metric.tone === 'warning' && 'text-amber-600',
              metric.tone === 'success' && 'text-teal-700',
            )}
          >
            {metric.value}
          </p>
          {metric.trend === 'down' ? (
            <TrendingDown className="size-4 shrink-0 text-rose-500" aria-hidden="true" />
          ) : null}
        </div>
        <p
          className={cn(
            'mt-1 mb-0 text-[11px] text-slate-400',
            metric.tone === 'warning' && 'text-amber-600',
          )}
        >
          {metric.detail}
        </p>
      </CardContent>
    </Card>
  )
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
    <Card className="h-full rounded-lg shadow-none">
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
                  content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-[10px]" />}
                />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-x-0 top-[94px] text-center">
              <strong className="block text-2xl tracking-tight text-slate-950">
                {numberFormatter.format(recoveryRate)}%
              </strong>
              <span className="text-[10px] text-slate-500">Recovery</span>
            </div>
          </div>
        ) : (
          <p className="flex h-[280px] items-center justify-center text-sm text-slate-500">
            No contractor outcomes for this period.
          </p>
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
    <Card className="rounded-lg shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4 p-4 pb-1">
        <CardTitle className="text-sm">Contractor Outcomes in {year}</CardTitle>
        <p className="mb-0 text-right text-[10px] text-slate-400">Annual monthly trend</p>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 sm:pt-2">
        {data.length ? (
          <div className="overflow-x-auto">
            <ChartContainer config={chartConfig} className="h-[320px] min-w-[700px] w-full">
              <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 8, left: -12 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month_label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} />
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <ChartLegend
                  content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-[10px]" />}
                />
                <Bar dataKey="upcycled" stackId="outcome" fill="var(--color-upcycled)" />
                <Bar
                  dataKey="fibre_to_fibre"
                  stackId="outcome"
                  fill="var(--color-fibre_to_fibre)"
                />
                <Bar dataKey="downcycled" stackId="outcome" fill="var(--color-downcycled)" />
                <Bar dataKey="exported" stackId="outcome" fill="var(--color-exported)" />
                <Bar dataKey="landfilled" stackId="outcome" fill="var(--color-landfilled)" />
                <Bar
                  dataKey="incinerated_energy_recovery"
                  stackId="outcome"
                  fill="var(--color-incinerated_energy_recovery)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-slate-500">
            No monthly outcome data is available for {year}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ExceptionTable({ exceptions }: { exceptions: DashboardException[] }) {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-4 p-4 pb-2">
        <CardTitle className="text-sm">Pending and Disputed Handoffs</CardTitle>
        <span className="text-[10px] text-slate-400">Exceptions</span>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        {exceptions.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-medium text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Bin ID</th>
                    <th className="px-4 py-2">Contractor</th>
                    <th className="px-4 py-2">Handoff Date</th>
                    <th className="px-4 py-2">Items</th>
                    <th className="px-4 py-2">Staff Weight</th>
                    <th className="px-4 py-2">Driver Weight</th>
                    <th className="px-4 py-2">Variance</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.map((exception) => (
                    <tr
                      key={exception.handoff_id}
                      className="border-t border-slate-100 text-slate-600"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">{exception.bin_code}</td>
                      <td className="px-4 py-3">{exception.contractor_name}</td>
                      <td className="px-4 py-3">
                        {dateFormatter.format(new Date(exception.handoff_date))}
                      </td>
                      <td className="px-4 py-3">{numberFormatter.format(exception.item_count)}</td>
                      <td className="px-4 py-3">{formatWeight(exception.staff_weight_kg)}</td>
                      <td className="px-4 py-3">{formatWeight(exception.driver_weight_kg)}</td>
                      <td
                        className={cn(
                          'px-4 py-3',
                          exception.status === 'disputed' && 'text-rose-600',
                        )}
                      >
                        {numberFormatter.format(exception.variance_percent)}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-1 text-[10px] font-medium',
                            exception.status === 'pending'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-600',
                          )}
                        >
                          {exception.status === 'pending' ? 'Pending report' : 'Disputed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 mb-0 px-4 text-[10px] text-slate-400">
              Showing {exceptions.length} exception{exceptions.length === 1 ? '' : 's'}
            </p>
          </>
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">
            No pending or disputed handoffs for this period.
          </p>
        )}
      </CardContent>
    </Card>
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

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-teal-700">Operations / Compliance</p>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Compliance Dashboard
          </h1>
          <p className="mb-0 text-sm text-slate-500">
            Live handoff and contractor outcome data from Textile Track
          </p>
        </div>
        <Button asChild size="sm" className="bg-teal-700 text-white hover:bg-teal-800">
          <Link to=".">
            <Download aria-hidden="true" />
            Export Report
          </Link>
        </Button>
      </section>

      <Separator />

      <section aria-labelledby="dashboard-filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="dashboard-filters" className="mb-1 text-sm font-semibold text-slate-900">
              Dashboard Filters
            </h2>
            <p className="mb-0 text-xs text-slate-500">
              Adjust the site, reporting period, and contractor.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <DashboardSelect
              label="Site"
              value={siteId}
              width="sm:w-48"
              items={siteOptions}
              onValueChange={(value) => updateFilter(() => setSiteId(value))}
            />
            <DashboardSelect
              label="Reporting frequency"
              value={frequency}
              width="sm:w-32"
              items={frequencyOptions}
              onValueChange={(value) =>
                updateFilter(() => setFrequency(value as DashboardFrequency))
              }
            />
            <DashboardSelect
              label="Reporting year"
              value={String(year)}
              width="sm:w-24"
              items={yearOptions}
              onValueChange={(value) => updateFilter(() => setYear(Number(value)))}
            />
            {frequency === 'monthly' ? (
              <DashboardSelect
                label="Reporting month"
                value={String(month)}
                width="sm:w-28"
                items={monthOptions}
                onValueChange={(value) => updateFilter(() => setMonth(Number(value)))}
              />
            ) : null}
            {frequency === 'quarterly' ? (
              <DashboardSelect
                label="Reporting quarter"
                value={String(quarter)}
                width="sm:w-32"
                items={quarterOptions}
                onValueChange={(value) => updateFilter(() => setQuarter(Number(value)))}
              />
            ) : null}
            <DashboardSelect
              label="Contractor"
              value={contractorId}
              width="sm:w-52"
              items={contractorOptions}
              onValueChange={(value) => updateFilter(() => setContractorId(value))}
            />
          </div>
        </div>
      </section>

      {error ? (
        <Card role="alert" className="border-rose-200 bg-rose-50 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="mb-1 font-medium">Dashboard data could not be loaded.</p>
                <p className="mb-0 text-xs text-rose-700">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={retryDashboard}>
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading && !dashboard ? <DashboardLoading /> : null}

      {dashboard ? (
        <div className={cn('space-y-5 transition-opacity', isLoading && 'opacity-60')}>
          <section aria-labelledby="period-overview" className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h2 id="period-overview" className="mb-0 text-sm font-semibold text-slate-900">
                Period overview
              </h2>
              <span className="text-[10px] text-slate-400">{dashboard.period_label}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {summaryMetrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </div>
              <OutcomeDonut
                outcomes={dashboard.outcomes}
                recoveryRate={dashboard.summary.recovery_rate}
              />
            </div>
          </section>

          <MonthlyOutcomeChart data={dashboard.monthly_outcomes} year={dashboard.year} />
          <ExceptionTable exceptions={dashboard.exceptions} />

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Database className="size-4 text-teal-600" aria-hidden="true" />
            <span>Live data from the Textile Track database.</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DashboardSelect({
  label,
  value,
  width,
  items,
  onValueChange,
}: {
  label: string
  value: string
  width: string
  items: SelectOption[]
  onValueChange: (value: string) => void
}) {
  const selectedLabel = items.find((item) => item.value === value)?.label

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          'h-9 min-w-0 max-w-full gap-2 overflow-hidden text-xs [&>svg]:shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left',
          width,
        )}
        aria-label={label}
        title={selectedLabel}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-96">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            title={item.label}
            className="min-w-0 max-w-full whitespace-normal"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
