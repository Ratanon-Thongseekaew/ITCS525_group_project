import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { ApiError, type ContractorCreateRequest } from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from './FormField'
import { emailPattern, errorProps } from './form-errors'

type FieldName = 'name' | 'email'
type Errors = Partial<Record<FieldName, string>>

interface AddContractorFormProps {
  existingNames: string[]
  onAdd: (contractor: ContractorCreateRequest) => Promise<void>
}

/** Adds a recycling contractor. Only the company name is required. */
export function AddContractorForm({ existingNames, onAdd }: AddContractorFormProps) {
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }))
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const takenNames = existingNames.map((existing) => existing.toLowerCase())
    const next: Errors = {}

    if (!cleanName) next.name = 'Enter a company name.'
    else if (takenNames.includes(cleanName.toLowerCase())) {
      next.name = 'A contractor with this name already exists.'
    }
    if (cleanEmail && !emailPattern.test(cleanEmail)) next.email = 'Enter a valid email address.'

    setErrors(next)
    setServerError(null)
    if (Object.keys(next).length > 0) return

    setIsSubmitting(true)
    try {
      await onAdd({
        name: cleanName,
        contact_name: contactName.trim() || null,
        contact_email: cleanEmail || null,
      })
      setName('')
      setContactName('')
      setEmail('')
    } catch (caught) {
      setServerError(
        (caught instanceof ApiError && caught.detail) || 'Could not add the contractor. Try again.',
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
          <CardTitle className="text-sm font-semibold">Add a new contractor</CardTitle>
          <CardDescription className="text-xs">
            Active contractors can be chosen for recycle bin pickups and report imports.
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
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start"
        >
          <FormField id="add-contractor-name" label="Company name" error={errors.name}>
            <Input
              id="add-contractor-name"
              placeholder="e.g. GreenLoop Recycling"
              maxLength={160}
              value={name}
              {...errorProps('add-contractor-name', errors.name)}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
          </FormField>
          <FormField id="add-contractor-contact" label="Contact name (optional)">
            <Input
              id="add-contractor-contact"
              placeholder="e.g. Narin S."
              maxLength={120}
              value={contactName}
              onChange={(event) => {
                setContactName(event.target.value)
                setServerError(null)
              }}
            />
          </FormField>
          <FormField
            id="add-contractor-email"
            label="Contact email (optional)"
            error={errors.email}
          >
            <Input
              id="add-contractor-email"
              type="email"
              placeholder="name@company.com"
              maxLength={255}
              value={email}
              {...errorProps('add-contractor-email', errors.email)}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
              }}
            />
          </FormField>
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" className="px-8" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
