import { useState, type FormEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { stores, userRoles, type Store, type TeamUser, type UserRole } from '@/types/user'
import { OptionSelect } from './OptionSelect'

type InviteField = 'name' | 'email' | 'role' | 'store'
type InviteErrors = Partial<Record<InviteField, string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface InviteFieldProps {
  id: string
  label: string
  error?: string
  children: ReactNode
}

function InviteField({ id, label, error, children }: InviteFieldProps) {
  return (
    <Field data-invalid={Boolean(error) || undefined} className="gap-2">
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${id}-error`} className="text-xs">
          {error}
        </FieldError>
      ) : null}
    </Field>
  )
}

function errorProps(id: string, error?: string) {
  return {
    'aria-invalid': Boolean(error) || undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  }
}

interface InviteUserFormProps {
  existingEmails: string[]
  onAdd: (user: Omit<TeamUser, 'id' | 'status' | 'createdAt'>) => void
}

/** Adds a team member. New members start as Invited. */
export function InviteUserForm({ existingEmails, onAdd }: InviteUserFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [store, setStore] = useState<Store | ''>('')
  const [errors, setErrors] = useState<InviteErrors>({})

  function clearError(field: InviteField) {
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const next: InviteErrors = {}

    if (!name.trim()) next.name = 'Enter a full name.'
    if (!cleanEmail) next.email = 'Enter an email address.'
    else if (!emailPattern.test(cleanEmail)) next.email = 'Enter a valid email address.'
    else if (existingEmails.includes(cleanEmail)) next.email = 'This email already exists.'
    if (!role) next.role = 'Select a role.'
    if (!store) next.store = 'Select a store.'

    if (Object.keys(next).length > 0 || !role || !store) {
      setErrors(next)
      return
    }

    onAdd({ name: name.trim(), email: cleanEmail, role, store })
    setName('')
    setEmail('')
    setRole('')
    setStore('')
    setErrors({})
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 p-5 pb-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm font-semibold">Invite a new team member</CardTitle>
          <CardDescription className="text-xs">
            They&rsquo;ll receive an email to set their password.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto] lg:items-start"
        >
          <InviteField id="invite-name" label="Full name" error={errors.name}>
            <Input
              id="invite-name"
              placeholder="e.g. Narin S."
              value={name}
              {...errorProps('invite-name', errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
          </InviteField>
          <InviteField id="invite-email" label="Email address" error={errors.email}>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              {...errorProps('invite-email', errors.email)}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
              }}
            />
          </InviteField>
          <InviteField id="invite-role" label="Role" error={errors.role}>
            <OptionSelect
              id="invite-role"
              value={role}
              options={userRoles}
              placeholder="Select role"
              invalid={Boolean(errors.role)}
              describedBy={errors.role ? 'invite-role-error' : undefined}
              onChange={(value) => {
                setRole(value)
                clearError('role')
              }}
            />
          </InviteField>
          <InviteField id="invite-store" label="Store" error={errors.store}>
            <OptionSelect
              id="invite-store"
              value={store}
              options={stores}
              placeholder="Select store"
              invalid={Boolean(errors.store)}
              describedBy={errors.store ? 'invite-store-error' : undefined}
              onChange={(value) => {
                setStore(value)
                clearError('store')
              }}
            />
          </InviteField>
          {/* The spacer matches the field labels so the button lines up with the inputs. */}
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
            <span className="hidden h-4 lg:block" aria-hidden="true" />
            <Button type="submit" className="px-8">
              Add
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
