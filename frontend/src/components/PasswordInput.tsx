import { type ComponentProps, useState } from 'react'
import { Eye, EyeClosed, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordInputProps extends Omit<ComponentProps<typeof Input>, 'type' | 'id'> {
  id: string
  label: string
}

/** A labelled password field with a show/hide button. */
export function PasswordInput({ id, label, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? Eye : EyeClosed

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          className="pr-10 pl-10"
          required
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-muted-foreground"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
