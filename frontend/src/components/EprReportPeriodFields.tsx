import { useId } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EprReportPeriodFieldsProps {
  year: number
  quarter: number
  years: number[]
  disabled?: boolean
  onYearChange: (year: number) => void
  onQuarterChange: (quarter: number) => void
}

export function EprReportPeriodFields({
  year,
  quarter,
  years,
  disabled,
  onYearChange,
  onQuarterChange,
}: EprReportPeriodFieldsProps) {
  const id = useId()
  const yearOptions = [...new Set([year, ...years])].sort((a, b) => b - a)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-year`} className="text-sm font-medium">
          Year
        </label>
        <Select
          value={String(year)}
          onValueChange={(value) => onYearChange(Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-year`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${id}-quarter`} className="text-sm font-medium">
          Quarter
        </label>
        <Select
          value={String(quarter)}
          onValueChange={(value) => onQuarterChange(Number(value))}
          disabled={disabled}
        >
          <SelectTrigger id={`${id}-quarter`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4].map((option) => (
              <SelectItem key={option} value={String(option)}>
                Quarter {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
