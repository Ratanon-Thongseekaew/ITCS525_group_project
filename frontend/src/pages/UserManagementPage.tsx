import { useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
  ApiError,
  createUser,
  deleteUser,
  listSites,
  listUsers,
  resetUserPassword,
  updateUser,
  type User,
  type UserCreateRequest,
  type UserRole,
  type UserUpdateRequest,
  type UserWithTemporaryPassword,
} from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddUserForm } from '@/components/admin/AddUserForm'
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog'
import { EditUserDialog } from '@/components/admin/EditUserDialog'
import { TemporaryPasswordDialog } from '@/components/admin/TemporaryPasswordDialog'
import { UserIdentity } from '@/components/admin/UserIdentity'
import { UserStatusBadge } from '@/components/admin/UserStatusBadge'
import { roleLabels, roleOptions } from '@/components/admin/user-options'
import { FilterSelect } from '@/components/FilterSelect'
import { LoadState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { SearchInput } from '@/components/SearchInput'
import { TableCard } from '@/components/TableCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession, signIn } from '@/lib/auth-session'
import { useApiResource } from '@/lib/use-api-resource'

const roleFilterOptions = [{ value: 'all', label: 'All roles' }, ...roleOptions]

// Keeps the temporary password out of the user list.
function withoutPassword(result: UserWithTemporaryPassword): User {
  return { ...result, temporary_password: undefined } as User
}

function failureReason(error: unknown) {
  return (error instanceof ApiError && error.detail) || 'Try again.'
}

export function UserManagementPage() {
  const session = useSession()
  const token = session?.token ?? ''
  const { data, error, retry, update } = useApiResource(
    token ? 'admin-users' : null,
    async () => {
      const [users, sites] = await Promise.all([listUsers(token), listSites(token)])
      return { users, sites }
    },
    'Could not load users.',
  )
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [resetting, setResetting] = useState<User | null>(null)
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null)

  const users = useMemo(() => data?.users ?? [], [data])
  const sites = data?.sites ?? []

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesSearch =
        !search ||
        (user.full_name ?? '').toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search)
      return matchesRole && matchesSearch
    })
  }, [users, query, roleFilter])

  function replaceUser(updated: User) {
    update((current) => ({
      ...current,
      users: current.users.map((user) => (user.id === updated.id ? updated : user)),
    }))
  }

  function showPassword(result: UserWithTemporaryPassword) {
    if (result.temporary_password) {
      setIssued({ username: result.username, password: result.temporary_password })
    }
  }

  async function addUser(input: UserCreateRequest) {
    const result = await createUser(token, input)
    update((current) => ({ ...current, users: [...current.users, withoutPassword(result)] }))
    showPassword(result)
  }

  async function saveUser(user: User, changes: UserUpdateRequest) {
    if (Object.keys(changes).length > 0) {
      const updated = await updateUser(token, user.id, changes)
      replaceUser(updated)
      if (updated.id === session?.user.id) signIn({ token, user: updated })
      toast.success('User updated')
    }
    setEditing(null)
  }

  async function removeUser(user: User) {
    setDeleting(null)
    try {
      await deleteUser(token, user.id)
      update((current) => ({
        ...current,
        users: current.users.filter((item) => item.id !== user.id),
      }))
      toast.success('User deleted')
    } catch (caught) {
      toast.error('Could not delete the user', { description: failureReason(caught) })
    }
  }

  async function resetPassword(user: User) {
    setResetting(null)
    try {
      const result = await resetUserPassword(token, user.id)
      replaceUser(withoutPassword(result))
      showPassword(result)
    } catch (caught) {
      toast.error('Could not reset the password', { description: failureReason(caught) })
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="User Management"
        description="Add team members and control access across your stores."
        actions={<Badge variant="outline">Admin &middot; Team</Badge>}
      />

      <LoadState isLoading={!data} error={error} loadingLabel="Loading users..." onRetry={retry} />

      {data ? (
        <>
          <AddUserForm
            sites={sites}
            existingEmails={users.map((user) => user.username)}
            onAdd={addUser}
          />

          <TableCard
            title="Current users"
            description={`${users.length} ${users.length === 1 ? 'user' : 'users'}`}
            actions={
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SearchInput
                  label="Search users"
                  placeholder="Search users..."
                  value={query}
                  onChange={setQuery}
                  className="flex-1 sm:w-56 sm:flex-none"
                />
                <FilterSelect
                  label="Filter by role"
                  value={roleFilter}
                  items={roleFilterOptions}
                  onValueChange={(value) => setRoleFilter(value as 'all' | UserRole)}
                  className="h-9 w-32 text-sm"
                />
              </div>
            }
          >
            <Table className="min-w-[640px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 text-xs uppercase">User</TableHead>
                  <TableHead className="px-4 text-xs uppercase">Role</TableHead>
                  <TableHead className="px-4 text-xs uppercase">Store</TableHead>
                  <TableHead className="px-4 text-xs uppercase">Status</TableHead>
                  <TableHead className="w-10 px-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No users match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
                {visibleUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="px-4 py-3">
                      <UserIdentity user={user} />
                    </TableCell>
                    <TableCell className="px-4 py-3">{roleLabels[user.role]}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {user.store?.name ?? '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <UserStatusBadge temporary={user.must_change_password} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${user.full_name || user.username}`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(user)}>
                            Edit user
                          </DropdownMenuItem>
                          {user.id !== session?.user.id ? (
                            <>
                              <DropdownMenuItem onSelect={() => setResetting(user)}>
                                Reset password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleting(user)}
                              >
                                Delete user
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </>
      ) : null}

      {editing ? (
        <EditUserDialog
          key={editing.id}
          user={editing}
          sites={sites}
          isSelf={editing.id === session?.user.id}
          onClose={() => setEditing(null)}
          onSave={(changes) => saveUser(editing, changes)}
        />
      ) : null}
      {deleting ? (
        <DeleteUserDialog
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeUser(deleting)}
        />
      ) : null}
      {resetting ? (
        <ConfirmDialog
          title="Reset password?"
          description={`${resetting.username} will get a new temporary password and the old one will stop working.`}
          confirmLabel="Reset password"
          onCancel={() => setResetting(null)}
          onConfirm={() => resetPassword(resetting)}
        />
      ) : null}
      {issued ? <TemporaryPasswordDialog {...issued} onClose={() => setIssued(null)} /> : null}
    </section>
  )
}
