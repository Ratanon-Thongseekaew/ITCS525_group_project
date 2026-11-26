import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OptionSelectProps {
  id: string
  value: string
  options: readonly { value: string; label: string }[]
  placeholder: string
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  onChange: (value: string) => void
}

/** A labelled-by-id select, such as for roles or stores. */
export function OptionSelect({
  id,
  value,
  options,
  placeholder,
  invalid,
  describedBy,
  disabled,
  onChange,
}: OptionSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
