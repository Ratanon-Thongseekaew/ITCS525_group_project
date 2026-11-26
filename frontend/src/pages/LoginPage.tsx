import { type FormEvent, useState } from 'react'
import { CircleAlert, LogIn, UserRound } from 'lucide-react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'
import { ApiError, login } from '@/api'
import { AuthScreen } from '@/components/AuthScreen'
import { PasswordInput } from '@/components/PasswordInput'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getWorkspaceHomeUrl } from '@/config/workspace-navigation'
import { sessionExpired, signIn, useSession } from '@/lib/auth-session'

function loginErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) return 'Wrong email or password.'
  return 'Could not sign in. Check that the server is running, then try again.'
}

export function LoginPage() {
  const user = useSession()?.user
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Covers both a fresh sign in and visiting this page while already signed in.
  if (user) {
    const to = user.must_change_password ? '/change-password' : getWorkspaceHomeUrl(user.role)
    return <Navigate to={to} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await login(username.trim(), password)
      toast.success('Login successful')
      signIn({ token: result.access_token, user: result.user })
    } catch (caught) {
      setError(loginErrorMessage(caught))
      setIsSubmitting(false)
    }
  }

  return (
    <AuthScreen eyebrow="Welcome back" title="Login">
      <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
        {error ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Login failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : sessionExpired() ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>Your session ended. Sign in again.</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="username">Email</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            {/* Not type="email": the server accepts any username. */}
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              className="pl-10"
              placeholder="name@company.com"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
        </div>

        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button className="mt-2 w-full" type="submit" disabled={isSubmitting}>
          <LogIn className="size-4" />
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>

        <p className="text-center text-xs leading-5 text-muted-foreground">
          Forgot your password? Ask your administrator to reset it.
        </p>
      </form>
    </AuthScreen>
  )
}
