import { useId } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
}

interface FilterSelectProps {
  label: string
  value: string
  items: readonly FilterOption[]
  onValueChange: (value: string) => void
  /** `hidden` names the trigger with `aria-label`; `inline` shows a label before it. */
  labelMode?: 'hidden' | 'inline'
  placeholder?: string
  disabled?: boolean
  /** Width classes for the trigger, such as `sm:w-48`. */
  className?: string
}

/** A compact select for filtering or sorting a list. Long values truncate with a tooltip. */
export function FilterSelect({
  label,
  value,
  items,
  onValueChange,
  labelMode = 'hidden',
  placeholder,
  disabled,
  className,
}: FilterSelectProps) {
  const id = useId()
  const selectedLabel = items.find((item) => item.value === value)?.label

  const select = (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        aria-label={labelMode === 'hidden' ? label : undefined}
        title={selectedLabel}
        className={cn(
          'h-9 max-w-full min-w-0 gap-2 overflow-hidden text-xs [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left [&>svg]:shrink-0',
          labelMode === 'inline' && 'w-auto text-sm font-medium',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-96">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            title={item.label}
            className="max-w-full min-w-0 whitespace-normal"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (labelMode === 'hidden') return select

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="font-normal whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      {select}
    </div>
  )
}
