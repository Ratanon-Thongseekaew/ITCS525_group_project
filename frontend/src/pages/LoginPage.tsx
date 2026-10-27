import { type FormEvent, useState } from 'react'
import { LockKeyhole, LogIn, Shirt, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type UserRole = 'manager' | 'staff' | 'admin'

const roleDetails: Record<UserRole, { access: string; username: string }> = {
  manager: { access: 'Manager access', username: 'Manager01' },
  staff: { access: 'Staff access', username: 'Staff01' },
  admin: { access: 'Admin access', username: 'Admin01' },
}

export function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('admin')
  const [username, setUsername] = useState(roleDetails.admin.username)

  function changeRole(value: string) {
    const nextRole = value as UserRole
    setRole(nextRole)
    setUsername(roleDetails[nextRole].username)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/${role}`)
  }

  return (
    <main className="flex min-h-screen min-h-svh w-full flex-col bg-white text-slate-950">
      <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 sm:min-h-20 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2.5" aria-label="Textile Track">
          <span className="grid size-8 place-items-center rounded-md bg-teal-700 text-white sm:size-9">
            <Shirt className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">Textile Track</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs">
          <span className="size-1.5 rounded-full bg-teal-700" aria-hidden="true" />
          <span className="hidden capitalize min-[380px]:inline">{role} workspace</span>
          <span className="capitalize min-[380px]:hidden">{role}</span>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-50/60 px-4 py-8 sm:px-6 sm:py-12 lg:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(13, 148, 136, 0.08), transparent 32%), radial-gradient(circle at 85% 80%, rgba(15, 118, 110, 0.06), transparent 30%)',
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
              <div className="space-y-2">
                <Label htmlFor="role">Workspace role </Label>
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
                    onChange={(event) => setUsername(event.target.value)}
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
                    type="password"
                    autoComplete="current-password"
                    className="pl-10"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <Button className="mt-2 w-full" type="submit">
                <LogIn className="size-4" />
                Sign in
              </Button>

              <p className="text-center text-xs leading-5 text-slate-400">
                Demo mode: credentials are not validated yet.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
