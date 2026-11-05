import { type FormEvent, useEffect, useState } from 'react'
import { CircleAlert, Eye, EyeClosed, LockKeyhole, LogIn, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import textileTrackLogo from '@/assets/logos/textile-track-app-logo-1024.png'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextileTrackLoader } from '@/components/TextileTrackLoader'
import { getWorkspaceHomeUrl } from '@/config/workspace-navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { WorkspaceRole } from '@/types/workspace'

const roleDetails: Record<WorkspaceRole, { access: string; username: string }> = {
  manager: { access: 'Manager access', username: 'Manager01' },
  staff: { access: 'Staff access', username: 'Staff01' },
  admin: { access: 'Admin access', username: 'Admin01' },
}

export function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<WorkspaceRole>('admin')
  const [username, setUsername] = useState(roleDetails.admin.username)
  const [pendingRole, setPendingRole] = useState<WorkspaceRole | null>(null)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!pendingRole) {
      return
    }

    const loadingTimer = window.setTimeout(() => {
      navigate(getWorkspaceHomeUrl(pendingRole))
    }, 2_000)

    return () => window.clearTimeout(loadingTimer)
  }, [navigate, pendingRole])

  function changeRole(value: string) {
    const nextRole = value as WorkspaceRole
    setRole(nextRole)
    setUsername(roleDetails[nextRole].username)
    setLoginError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (username.trim() !== roleDetails[role].username) {
      const message = `Use ${roleDetails[role].username} for the ${role} workspace.`
      setLoginError(message)
      toast.error('Login failed', { description: message })
      return
    }

    setLoginError(null)
    toast.success('Login successful', {
      description: `Opening the ${role} workspace...`,
    })
    setPendingRole(role)
  }

  if (pendingRole) {
    return <TextileTrackLoader className="fixed inset-0 z-50" label="loading..." size={220} />
  }

  return (
    <main className="flex min-h-screen min-h-svh w-full flex-col bg-white text-slate-950">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:min-h-20 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5" aria-label="Textile Track">
          <img
            src={textileTrackLogo}
            alt=""
            className="size-8 object-contain sm:size-9"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold tracking-tight sm:text-base">Textile Track</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
          <span className="size-1.5 rounded-full bg-teal-700" aria-hidden="true" />
          <span className="hidden capitalize min-[380px]:inline">{role} workspace</span>
          <span className="capitalize min-[380px]:hidden">{role}</span>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-900 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <video
          className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="https://www.pexels.com/download/video/9594356/" type="video/mp4" />
        </video>
        <div
          className="pointer-events-none absolute inset-0 bg-slate-950/50"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(13, 148, 136, 0.22), transparent 36%), radial-gradient(circle at 85% 80%, rgba(15, 118, 110, 0.16), transparent 34%)',
          }}
        />

        <Card className="relative w-full max-w-[410px] shadow-[0_16px_45px_rgba(15,23,42,0.07)] sm:max-w-[430px]">
          <CardHeader className="space-y-2 px-5 pt-6 pb-5 sm:px-8 sm:pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">
              {roleDetails[role].access}
            </p>
            <CardTitle className="text-xl sm:text-2xl">Login</CardTitle>
          </CardHeader>

          <CardContent className="px-5 pb-6 sm:px-8 sm:pb-8">
            <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
              {loginError ? (
                <Alert
                  variant="destructive"
                  className="border-rose-200 bg-rose-50 text-rose-700 [&>svg]:text-rose-600"
                >
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Login failed</AlertTitle>
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="role">Workspace role</Label>
                <Select value={role} onValueChange={changeRole}>
                  <SelectTrigger id="role" aria-label="Workspace role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    className="pl-10"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value)
                      setLoginError(null)
                    }}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-10 pl-10"
                    placeholder="Enter your password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 size-8 -translate-y-1/2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((isVisible) => !isVisible)}
                  >
                    {showPassword ? (
                      <Eye className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeClosed className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              <Button className="mt-2 w-full" type="submit">
                <LogIn className="size-4" />
                Sign in
              </Button>

              <p className="text-center text-xs leading-5 text-slate-400">
                Demo mode: use the suggested username and any non-empty password.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
