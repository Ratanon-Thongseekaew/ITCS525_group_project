import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { MoreHorizontal, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { initialUsers } from '@/lib/mock-users'
import { stores, userRoles, type Store, type TeamUser, type UserRole } from '@/types/user'

// Explicit colours so this page does not depend on the repo's partial shadcn theme variables.
const fieldClass = 'h-10 border-slate-300 bg-white text-sm shadow-none'
const popupClass = 'border-slate-200 bg-white text-slate-900'
const cancelButtonClass = 'hover:bg-slate-50'

// Inline styles win over global CSS that overrides Tailwind classes in this repo.
const fieldStyle: CSSProperties = { borderColor: '#cbd5e1', backgroundColor: '#ffffff' }
const popupStyle: CSSProperties = { borderColor: '#e2e8f0', backgroundColor: '#ffffff' }
const cancelStyle: CSSProperties = {
  borderColor: '#cbd5e1',
  backgroundColor: '#ffffff',
  color: '#0f172a',
}
const darkButtonStyle: CSSProperties = { backgroundColor: '#171717', color: '#ffffff' }
const greenButtonStyle: CSSProperties = { backgroundColor: '#064e3b', color: '#ffffff' }
const redButtonStyle: CSSProperties = {
  backgroundColor: '#b91c1c',
  borderColor: '#b91c1c',
  color: '#ffffff',
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface OptionSelectProps<T extends string> {
  id: string
  value: string
  options: readonly T[]
  placeholder: string
  onChange: (value: T) => void
}

function OptionSelect<T extends string>({
  id,
  value,
  options,
  placeholder,
  onChange,
}: OptionSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger id={id} className={`w-full ${fieldClass}`} style={fieldStyle}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={popupClass} style={popupStyle}>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function StatusBadge({ status }: { status: TeamUser['status'] }) {
  const style =
    status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{status}</span>
}

function UserAvatar({ user }: { user: TeamUser }) {
  const style =
    user.status === 'Active' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-700'
  return (
    <span
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${style}`}
      aria-hidden="true"
    >
      {getInitials(user.name)}
    </span>
  )
}

interface InviteFormProps {
  existingEmails: string[]
  onAdd: (user: Omit<TeamUser, 'id' | 'status' | 'createdAt'>) => void
}

type InviteField = 'name' | 'email' | 'role' | 'store'
type InviteErrors = Partial<Record<InviteField, string>>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="absolute top-full left-0 mt-1 text-xs text-red-600">
      {message}
    </p>
  )
}

function InviteForm({ existingEmails, onAdd }: InviteFormProps) {
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
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
            <Plus className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invite a new team member</h2>
            <p className="text-xs text-slate-500">
              They&rsquo;ll receive an email to set their password.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-5 grid pb-4 gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto] lg:items-end"
        >
          <div className="relative flex flex-col gap-2">
            <Label
              htmlFor="invite-name"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Full name
            </Label>
            <Input
              className={fieldClass}
              style={fieldStyle}
              id="invite-name"
              placeholder="e.g. Narin S."
              aria-invalid={Boolean(errors.name)}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                clearError('name')
              }}
            />
            <FieldError message={errors.name} />
          </div>
          <div className="relative flex flex-col gap-2">
            <Label
              htmlFor="invite-email"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Email address
            </Label>
            <Input
              className={fieldClass}
              style={fieldStyle}
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              aria-invalid={Boolean(errors.email)}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                clearError('email')
              }}
            />
            <FieldError message={errors.email} />
          </div>
          <div className="relative flex flex-col gap-2">
            <Label
              htmlFor="invite-role"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Role
            </Label>
            <OptionSelect
              id="invite-role"
              value={role}
              options={userRoles}
              placeholder="Select role"
              onChange={(value) => {
                setRole(value)
                clearError('role')
              }}
            />
            <FieldError message={errors.role} />
          </div>
          <div className="relative flex flex-col gap-2">
            <Label
              htmlFor="invite-store"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Store
            </Label>
            <OptionSelect
              id="invite-store"
              value={store}
              options={stores}
              placeholder="Select store"
              onChange={(value) => {
                setStore(value)
                clearError('store')
              }}
            />
            <FieldError message={errors.store} />
          </div>
          <Button type="submit" className="h-10 px-8 hover:opacity-90" style={darkButtonStyle}>
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

interface EditUserDialogProps {
  user: TeamUser
  onClose: () => void
  onSave: (user: TeamUser) => void
}

function EditUserDialog({ user, onClose, onSave }: EditUserDialogProps) {
  const [draft, setDraft] = useState(user)
  const canSave = draft.name.trim() !== '' && draft.email.includes('@')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`${popupClass} sm:max-w-md`} style={popupStyle}>
        <DialogHeader>
          <DialogTitle className="text-slate-900">Edit user</DialogTitle>
          <DialogDescription className="text-slate-500">
            Update account access and store assignment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3">
          <UserAvatar user={user} />
          <div>
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name" className="h-4 text-xs leading-4 font-normal text-slate-600">
              Full name
            </Label>
            <Input
              className={fieldClass}
              style={fieldStyle}
              id="edit-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="edit-email"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Email address
            </Label>
            <Input
              className={fieldClass}
              style={fieldStyle}
              id="edit-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-role" className="h-4 text-xs leading-4 font-normal text-slate-600">
              Role
            </Label>
            <OptionSelect
              id="edit-role"
              value={draft.role}
              options={userRoles}
              placeholder="Select role"
              onChange={(role) => setDraft({ ...draft, role })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="edit-store"
              className="h-4 text-xs leading-4 font-normal text-slate-600"
            >
              Store
            </Label>
            <OptionSelect
              id="edit-store"
              value={draft.store}
              options={stores}
              placeholder="Select store"
              onChange={(store) => setDraft({ ...draft, store })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className={cancelButtonClass}
            style={cancelStyle}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={!canSave}
            className="hover:opacity-90"
            style={greenButtonStyle}
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteUserDialogProps {
  user: TeamUser
  onClose: () => void
  onConfirm: () => void
}

function DeleteUserDialog({ user, onClose, onConfirm }: DeleteUserDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`${popupClass} sm:max-w-md`} style={popupStyle}>
        <DialogHeader>
          <DialogTitle className="text-slate-900">Delete {user.name}?</DialogTitle>
          <DialogDescription className="text-slate-500">
            This user will immediately lose access to Textile Track. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <UserAvatar user={user} />
          <div>
            <p className="text-sm font-medium text-slate-900">
              {user.name} &middot; {user.role}
            </p>
            <p className="text-xs text-slate-500">
              {user.store} &middot; {user.email}
            </p>
          </div>
        </div>

        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
          No data history will be deleted.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            className={cancelButtonClass}
            style={cancelStyle}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="hover:opacity-90" style={redButtonStyle} onClick={onConfirm}>
            Delete user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserManagementPage() {
  const [users, setUsers] = useState<TeamUser[]>(initialUsers)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [editing, setEditing] = useState<TeamUser | null>(null)
  const [deleting, setDeleting] = useState<TeamUser | null>(null)

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesSearch =
        !search ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search)
      return matchesRole && matchesSearch
    })
  }, [users, query, roleFilter])

  const activeCount = users.filter((user) => user.status === 'Active').length
  const storeCount = new Set(users.map((user) => user.store)).size

  function addUser(input: Omit<TeamUser, 'id' | 'status' | 'createdAt'>) {
    const user: TeamUser = {
      ...input,
      id: crypto.randomUUID(),
      status: 'Invited',
      createdAt: new Date().toISOString(),
    }
    setUsers((current) => [user, ...current])
  }

  function saveUser(updated: TeamUser) {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)))
    setEditing(null)
  }

  function deleteUser() {
    if (!deleting) return
    setUsers((current) => current.filter((user) => user.id !== deleting.id))
    setDeleting(null)
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Invite staff and control access across your stores.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          Admin &middot; Team
        </span>
      </header>

      <InviteForm existingEmails={users.map((user) => user.email)} onAdd={addUser} />

      <Card className="shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Current users</h2>
              <p className="text-xs text-slate-500">
                {activeCount} active users across {storeCount} stores
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-56 sm:flex-none">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Search users"
                  placeholder="Search users..."
                  className={`pl-9 ${fieldClass}`}
                  style={fieldStyle}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(value) => setRoleFilter(value as 'all' | UserRole)}
              >
                <SelectTrigger
                  aria-label="Filter by role"
                  className={`w-32 ${fieldClass}`}
                  style={fieldStyle}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={popupClass} style={popupStyle}>
                  <SelectItem value="all">All roles</SelectItem>
                  {userRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created at</th>
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      No users match your search.
                    </td>
                  </tr>
                )}
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div>
                          <p className="font-medium text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{user.role}</td>
                    <td className="px-4 py-3 text-slate-700">{user.store}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${user.name}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={popupClass} style={popupStyle}>
                          <DropdownMenuItem onSelect={() => setEditing(user)}>
                            Edit user
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={() => setDeleting(user)}
                          >
                            Delete user
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editing && (
        <EditUserDialog
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
          onSave={saveUser}
        />
      )}
      {deleting && (
        <DeleteUserDialog
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={deleteUser}
        />
      )}
    </section>
  )
}
