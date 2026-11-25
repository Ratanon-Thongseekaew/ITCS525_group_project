import { Search } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

interface SearchInputProps {
  /** Accessible name, such as "Search users". */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** A text input with a search icon, for filtering a list as you type. */
export function SearchInput({ label, value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </InputGroup>
  )
}
