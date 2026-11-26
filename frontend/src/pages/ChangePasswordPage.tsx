import { type FormEvent, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ApiError, changePassword } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { PasswordInput } from '@/components/PasswordInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { signIn, signOut, useSession } from '@/lib/auth-session'

function validate(current: string, next: string, confirm: string) {
  if (next.length < 8 || next.length > 128) return 'Use 8 to 128 characters.'
  if (next === current) return 'Choose a password different from the temporary one.'
  if (next !== confirm) return 'The new passwords do not match.'
  return null
}

/** Shown while the account still has a temporary password; `RequireAuth` keeps users here. */
export function ChangePasswordPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    const problem = validate(current, next, confirm)
    setError(problem)
    if (problem) return

    setIsSubmitting(true)
    try {
      const user = await changePassword(session.token, current, next)
      toast.success('Password changed')
      // The guard then sends the user to their workspace.
      signIn({ token: session.token, user })
    } catch (caught) {
      setError(
        (caught instanceof ApiError && caught.detail) ||
          'Could not change the password. Try again.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <AuthScreen eyebrow="First sign in" title="Set your new password">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <p className="text-sm text-muted-foreground">
          Replace the temporary password for {session?.user.username} to continue.
        </p>

        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <PasswordInput
          id="current-password"
          label="Temporary password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <PasswordInput
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <PasswordInput
          id="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save new password'}
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="ghost"
          onClick={() => {
            signOut()
            navigate('/login')
          }}
        >
          Sign out
        </Button>
      </form>
    </AuthScreen>
  )
}
