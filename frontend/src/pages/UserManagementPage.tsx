import { useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog'
import { EditUserDialog } from '@/components/admin/EditUserDialog'
import { InviteUserForm } from '@/components/admin/InviteUserForm'
import { UserIdentity } from '@/components/admin/UserIdentity'
import { UserStatusBadge } from '@/components/admin/UserStatusBadge'
import { FilterSelect } from '@/components/FilterSelect'
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
import { initialUsers } from '@/lib/mock-users'
import { userRoles, type TeamUser, type UserRole } from '@/types/user'

const roleFilterOptions = [
  { value: 'all', label: 'All roles' },
  ...userRoles.map((role) => ({ value: role, label: role })),
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
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
    <section className="flex flex-col gap-6">
      <PageHeader
        title="User Management"
        description="Invite staff and control access across your stores."
        actions={<Badge variant="outline">Admin &middot; Team</Badge>}
      />

      <InviteUserForm existingEmails={users.map((user) => user.email)} onAdd={addUser} />

      <TableCard
        title="Current users"
        description={`${activeCount} active users across ${storeCount} stores`}
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
              <TableHead className="px-4 text-xs uppercase">Created at</TableHead>
              <TableHead className="w-10 px-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users match your search.
                </TableCell>
              </TableRow>
            ) : null}
            {visibleUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="px-4 py-3">
                  <UserIdentity user={user} />
                </TableCell>
                <TableCell className="px-4 py-3">{user.role}</TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">{user.store}</TableCell>
                <TableCell className="px-4 py-3">
                  <UserStatusBadge status={user.status} />
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${user.name}`}>
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing(user)}>
                        Edit user
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(user)}>
                        Delete user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      {editing ? (
        <EditUserDialog
          key={editing.id}
          user={editing}
          onClose={() => setEditing(null)}
          onSave={saveUser}
        />
      ) : null}
      {deleting ? (
        <DeleteUserDialog
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={deleteUser}
        />
      ) : null}
    </section>
  )
}
