import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OptionSelectProps<T extends string> {
  id: string
  value: string
  options: readonly T[]
  placeholder: string
  invalid?: boolean
  describedBy?: string
  onChange: (value: T) => void
}

/** A select whose options are their own labels, such as roles or stores. */
export function OptionSelect<T extends string>({
  id,
  value,
  options,
  placeholder,
  invalid,
  describedBy,
  onChange,
}: OptionSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
