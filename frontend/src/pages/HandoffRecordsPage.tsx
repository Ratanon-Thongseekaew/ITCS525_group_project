import { useId, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { actionButtonClass } from '@/components/staff/handoff-ui'
import { HandoffRecordCard } from '@/components/staff/HandoffRecordCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getVisibleRecords } from '@/lib/handoff-records'
import { handoffRecords } from '@/lib/mock-handoff-records'
import {
  handoffRecordFilterLabels,
  handoffRecordSortLabels,
  type HandoffRecordFilter,
  type HandoffRecordSort,
} from '@/types/handoff'

interface RecordsControlProps<Value extends string> {
  label: string
  value: Value
  options: Record<Value, string>
  minWidthClass: string
  onChange: (value: Value) => void
}

function RecordsControl<Value extends string>({
  label,
  value,
  options,
  minWidthClass,
  onChange,
}: RecordsControlProps<Value>) {
  const id = useId()

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-sm font-normal whitespace-nowrap text-slate-500">
        {label}
      </Label>
      <Select value={value} onValueChange={(next) => onChange(next as Value)}>
        {/* Grows past the design's width so longer options like "Outcomes Received" don't clip. */}
        <SelectTrigger
          id={id}
          className={`h-9 w-auto gap-1.5 rounded-[10px] py-1.5 pr-2 pl-2.5 whitespace-nowrap shadow-none ${minWidthClass}`}
        >
          {/* On a span because the global button font and colour rules override utilities on the trigger. */}
          <span className="text-sm font-medium text-slate-900">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {Object.entries<string>(options).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function HandoffRecordsPage() {
  const [filter, setFilter] = useState<HandoffRecordFilter>('all')
  const [sort, setSort] = useState<HandoffRecordSort>('date')
  const visibleRecords = getVisibleRecords(handoffRecords, filter, sort)

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Operations</span>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="text-slate-500">Recycle Bin Handoff</span>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-slate-900" aria-current="page">
            Records
          </span>
        </nav>

        <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-[26px] leading-[26px] font-medium tracking-[-1px] text-slate-900">
              Handoff Records
            </h1>
            <p className="text-sm text-slate-500">
              Review contractor collections, recorded weights, and material outcomes.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className={`self-start sm:self-auto ${actionButtonClass}`}
          >
            <Link to="/staff/recycle-bin-handoff">
              <ArrowLeft aria-hidden="true" />
              Back to Handoff
            </Link>
          </Button>
        </header>
      </div>

      <section className="flex flex-col gap-4 border-t border-slate-200 pt-4">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <h2 className="text-sm font-medium text-slate-900">Handoff records</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <RecordsControl
              label="Filtered by:"
              value={filter}
              options={handoffRecordFilterLabels}
              minWidthClass="min-w-[96px]"
              onChange={setFilter}
            />
            <RecordsControl
              label="Sort by:"
              value={sort}
              options={handoffRecordSortLabels}
              minWidthClass="min-w-[112px]"
              onChange={setSort}
            />
          </div>
        </div>

        {visibleRecords.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {visibleRecords.map((record) => (
              <li key={record.id}>
                <HandoffRecordCard record={record} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">
            {filter === 'all' ? 'No handoff records yet.' : 'No handoff records match this filter.'}
          </p>
        )}
        <p className="text-xs text-slate-500" aria-live="polite">
          Showing {visibleRecords.length} of {handoffRecords.length} records
        </p>
      </section>
    </section>
  )
}
