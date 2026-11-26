import { useState, type FormEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, type Store, type UserCreateRequest, type UserRole } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { OptionSelect } from './OptionSelect'
import { roleOptions, storeOptions } from './user-options'

type FieldName = 'name' | 'email' | 'role' | 'store'
type Errors = Partial<Record<FieldName, string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormFieldProps {
  id: string
  label: string
  error?: string
  children: ReactNode
}

function FormField({ id, label, error, children }: FormFieldProps) {
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

interface AddUserFormProps {
  sites: Store[]
  existingEmails: string[]
  onAdd: (user: UserCreateRequest) => Promise<void>
}

/** Adds a team member. The server generates their temporary password. */
export function AddUserForm({ sites, existingEmails, onAdd }: AddUserFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole | ''>('')
  const [store, setStore] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const needsStore = role === 'staff' || role === 'manager'

  function clearError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const next: Errors = {}

    if (!name.trim()) next.name = 'Enter a full name.'
    if (!cleanEmail) next.email = 'Enter an email address.'
    else if (!emailPattern.test(cleanEmail)) next.email = 'Enter a valid email address.'
    else if (existingEmails.includes(cleanEmail)) next.email = 'This email already exists.'
    if (!role) next.role = 'Select a role.'
    if (needsStore && !store) next.store = 'Select a store.'

    setErrors(next)
    setServerError(null)
    if (Object.keys(next).length > 0 || !role) return

    setIsSubmitting(true)
    try {
      await onAdd({
        username: cleanEmail,
        full_name: name.trim(),
        role,
        ...(needsStore ? { site_id: Number(store) } : {}),
      })
      setName('')
      setEmail('')
      setRole('')
      setStore('')
    } catch (caught) {
      setServerError(
        (caught instanceof ApiError && caught.detail) || 'Could not add the user. Try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 p-5 pb-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Plus className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm font-semibold">Add a new team member</CardTitle>
          <CardDescription className="text-xs">
            You&rsquo;ll get a temporary password to hand over. No email is sent.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-5">
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-4 sm:grid-cols-2 lg:items-start"
        >
          <FormField id="add-name" label="Full name" error={errors.name}>
            <Input
              id="add-name"
              placeholder="e.g. Narin S."
              maxLength={120}
              value={name}
              {...errorProps('add-name', errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
          </FormField>
          <FormField id="add-email" label="Email address" error={errors.email}>
            <Input
              id="add-email"
              type="email"
              placeholder="name@company.com"
              value={email}
              {...errorProps('add-email', errors.email)}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
              }}
            />
          </FormField>
          <FormField id="add-role" label="Role" error={errors.role}>
            <OptionSelect
              id="add-role"
              value={role}
              options={roleOptions}
              placeholder="Select role"
              invalid={Boolean(errors.role)}
              describedBy={errors.role ? 'add-role-error' : undefined}
              onChange={(value) => {
                setRole(value as UserRole)
                clearError('role')
              }}
            />
          </FormField>
          {needsStore ? (
            <FormField id="add-store" label="Store" error={errors.store}>
              <OptionSelect
                id="add-store"
                value={store}
                options={storeOptions(sites)}
                placeholder="Select store"
                invalid={Boolean(errors.store)}
                describedBy={errors.store ? 'add-store-error' : undefined}
                onChange={(value) => {
                  setStore(value)
                  clearError('store')
                }}
              />
            </FormField>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" className="px-8" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
