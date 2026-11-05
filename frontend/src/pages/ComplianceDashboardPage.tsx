import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

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
import { cn } from '@/lib/utils'

interface SummaryMetric {
  label: string
  value: string
  detail: string
  tone?: 'default' | 'success' | 'warning'
  trend?: 'down'
}

const summaryMetrics = [
  { label: 'Recycling Bins Collected', value: '120', detail: 'Across 6 contractors' },
  { label: 'Recycling Bins Reported', value: '119', detail: '1 bin still pending' },
  {
    label: 'Bins with Discrepancies',
    value: '1',
    detail: 'Requiring investigation',
    tone: 'warning',
  },
  {
    label: 'Diverted from Landfill',
    value: '95%',
    detail: '4,560 kg diverted',
    tone: 'success',
  },
  { label: 'Total Weight Recorded', value: '4,800.0 kg', detail: 'Contractor source data' },
  {
    label: 'Total Weight Reported',
    value: '4,790.0 kg',
    detail: '-10.0 kg variance',
    trend: 'down',
  },
] satisfies readonly SummaryMetric[]

const outcomeData = [
  { category: 'upcycled', value: 35, fill: 'var(--color-upcycled)' },
  { category: 'recycled', value: 40, fill: 'var(--color-recycled)' },
  { category: 'downcycled', value: 20, fill: 'var(--color-downcycled)' },
  { category: 'exported', value: 4, fill: 'var(--color-exported)' },
  { category: 'landfill', value: 1, fill: 'var(--color-landfill)' },
]

const monthlyOutcomes = [
  { month: 'Mar', upcycled: 310, recycled: 380, downcycled: 200, exported: 50, landfill: 30 },
  { month: 'Apr', upcycled: 280, recycled: 370, downcycled: 220, exported: 40, landfill: 30 },
  { month: 'May', upcycled: 270, recycled: 380, downcycled: 200, exported: 40, landfill: 20 },
  { month: 'Jun', upcycled: 300, recycled: 400, downcycled: 190, exported: 50, landfill: 30 },
  { month: 'Jul', upcycled: 240, recycled: 350, downcycled: 170, exported: 40, landfill: 20 },
  { month: 'Aug', upcycled: 340, recycled: 410, downcycled: 210, exported: 50, landfill: 30 },
  { month: 'Sep', upcycled: 300, recycled: 390, downcycled: 180, exported: 40, landfill: 20 },
  { month: 'Oct', upcycled: 380, recycled: 430, downcycled: 220, exported: 60, landfill: 30 },
  { month: 'Nov', upcycled: 260, recycled: 370, downcycled: 170, exported: 40, landfill: 20 },
  { month: 'Dec', upcycled: 350, recycled: 420, downcycled: 200, exported: 50, landfill: 30 },
]

const chartConfig = {
  upcycled: { label: 'Upcycled', color: '#0f8f83' },
  recycled: { label: 'Recycled to fiber', color: '#3b82f6' },
  downcycled: { label: 'Downcycled', color: '#1e3a8a' },
  exported: { label: 'Exported overseas', color: '#f59e0b' },
  landfill: { label: 'Sent to landfill', color: '#64748b' },
} satisfies ChartConfig

const flaggedBins = [
  {
    id: 'tt-bin-16-001',
    contractor: 'Contractor 1',
    date: '14 Oct 2026',
    totalItems: '300',
    recordedWeight: '450 kg',
    reportedWeight: '—',
    status: 'Pending',
  },
  {
    id: 'tt-bin-16-002',
    contractor: 'Contractor 2',
    date: '15 Oct 2026',
    totalItems: '500',
    recordedWeight: '400 kg',
    reportedWeight: '390 kg (-10.0 kg)',
    status: 'Flagged',
  },
] as const

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

function OutcomeDonut() {
  return (
    <Card className="h-full rounded-lg shadow-none">
      <CardHeader className="p-4 pb-0">
        <CardTitle className="text-sm">End-of-life Breakdown by Outcome Categories</CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <div className="relative mx-auto w-full max-w-[480px]">
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <PieChart accessibilityLayer>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={outcomeData}
                dataKey="value"
                nameKey="category"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={1}
                strokeWidth={0}
              >
                {outcomeData.map((entry) => (
                  <Cell key={entry.category} fill={entry.fill} />
                ))}
              </Pie>
              <ChartLegend
                content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-[10px]" />}
              />
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-x-0 top-[94px] text-center">
            <strong className="block text-2xl tracking-tight text-slate-950">100%</strong>
            <span className="text-[10px] text-slate-500">Outcomes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthlyOutcomeChart() {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-4 p-4 pb-1">
        <CardTitle className="text-sm">Bin Outcomes in 2026</CardTitle>
        <p className="mb-0 text-right text-[10px] text-slate-400">
          Annual view · Sample category splits
        </p>
      </CardHeader>
      <CardContent className="p-2 sm:p-4 sm:pt-2">
        <div className="overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[320px] min-w-[700px] w-full">
            <BarChart
              accessibilityLayer
              data={monthlyOutcomes}
              margin={{ top: 12, right: 8, left: -12 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend
                content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2 text-[10px]" />}
              />
              <Bar dataKey="upcycled" stackId="outcome" fill="var(--color-upcycled)" />
              <Bar dataKey="recycled" stackId="outcome" fill="var(--color-recycled)" />
              <Bar dataKey="downcycled" stackId="outcome" fill="var(--color-downcycled)" />
              <Bar dataKey="exported" stackId="outcome" fill="var(--color-exported)" />
              <Bar
                dataKey="landfill"
                stackId="outcome"
                fill="var(--color-landfill)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function FlaggedBinsTable() {
  return (
    <Card className="rounded-lg shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-4 p-4 pb-2">
        <CardTitle className="text-sm">Pending and Flagged Bins</CardTitle>
        <span className="text-[10px] text-slate-400">Exceptions</span>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2">Bin ID</th>
                <th className="px-4 py-2">Contractor</th>
                <th className="px-4 py-2">Handoff Date</th>
                <th className="px-4 py-2">Total Items</th>
                <th className="px-4 py-2">Recorded Weight</th>
                <th className="px-4 py-2">Reported Weight</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {flaggedBins.map((bin) => (
                <tr key={bin.id} className="border-t border-slate-100 text-slate-600">
                  <td className="px-4 py-3 font-medium text-slate-900">{bin.id}</td>
                  <td className="px-4 py-3">{bin.contractor}</td>
                  <td className="px-4 py-3">{bin.date}</td>
                  <td className="px-4 py-3">{bin.totalItems}</td>
                  <td className="px-4 py-3">{bin.recordedWeight}</td>
                  <td className={cn('px-4 py-3', bin.status === 'Flagged' && 'text-rose-500')}>
                    {bin.reportedWeight}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-1 text-[10px] font-medium',
                        bin.status === 'Pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-600',
                      )}
                    >
                      {bin.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 mb-0 px-4 text-[10px] text-slate-400">Showing 2 of 2 bins</p>
      </CardContent>
    </Card>
  )
}

export function ComplianceDashboardPage() {
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-teal-700">Operations / Compliance</p>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Compliance Dashboard
          </h1>
          <p className="mb-0 text-sm text-slate-500">
            Outcome report files uploaded and analysis dashboard
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="bg-teal-700 text-white hover:bg-teal-800">
            <Link to=".">
              <Download aria-hidden="true" />
              Export Report
            </Link>
          </Button>
        </div>
      </section>

      <Separator />

      <section aria-labelledby="dashboard-filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="dashboard-filters" className="mb-1 text-sm font-semibold text-slate-900">
              Dashboard Filters
            </h2>
            <p className="mb-0 text-xs text-slate-500">
              Adjust the reporting period and contractor.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <DashboardSelect
              label="Reporting frequency"
              value="monthly"
              width="sm:w-32"
              items={['Monthly', 'Quarterly', 'Annual']}
            />
            <DashboardSelect
              label="Reporting year"
              value="2026"
              width="sm:w-24"
              items={['2026', '2025']}
            />
            <DashboardSelect
              label="Reporting month"
              value="october"
              width="sm:w-28"
              items={['October', 'September', 'August']}
            />
            <DashboardSelect
              label="Contractor"
              value="all-contractors"
              width="sm:w-40"
              items={['All Contractors', 'Contractor 1', 'Contractor 2']}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="monthly-overview" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="monthly-overview" className="mb-0 text-sm font-semibold text-slate-900">
            Monthly overview
          </h2>
          <span className="text-[10px] text-slate-400">October 2026</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {summaryMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
          <OutcomeDonut />
        </div>
      </section>

      <MonthlyOutcomeChart />
      <FlaggedBinsTable />

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <TrendingUp className="size-4 text-teal-600" aria-hidden="true" />
        <span>Mock dashboard data for interface preview only.</span>
      </div>
    </div>
  )
}

function DashboardSelect({
  label,
  value,
  width,
  items,
}: {
  label: string
  value: string
  width: string
  items: readonly string[]
}) {
  return (
    <Select defaultValue={value}>
      <SelectTrigger className={cn('h-9 min-w-0 text-xs', width)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item.toLowerCase().replaceAll(' ', '-')}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
