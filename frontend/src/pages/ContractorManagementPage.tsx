import { useMemo, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import {
  ApiError,
  createContractor,
  deleteContractor,
  listContractors,
  updateContractor,
  type Contractor,
  type ContractorCreateRequest,
  type ContractorUpdateRequest,
} from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddContractorForm } from '@/components/admin/AddContractorForm'
import { ContractorStatusBadge } from '@/components/admin/ContractorStatusBadge'
import { EditContractorDialog } from '@/components/admin/EditContractorDialog'
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
import { useSession } from '@/lib/auth-session'
import { useApiResource } from '@/lib/use-api-resource'

type StatusFilter = 'all' | 'active' | 'inactive'

const statusFilterOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function failureReason(error: unknown) {
  return (error instanceof ApiError && error.detail) || 'Try again.'
}

function byName(first: Contractor, second: Contractor) {
  return first.name.localeCompare(second.name)
}

export function ContractorManagementPage() {
  const session = useSession()
  const token = session?.token ?? ''
  const { data, error, retry, update } = useApiResource(
    token ? 'admin-contractors' : null,
    () => listContractors(token),
    'Could not load contractors.',
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<Contractor | null>(null)
  const [deactivating, setDeactivating] = useState<Contractor | null>(null)
  const [deleting, setDeleting] = useState<Contractor | null>(null)

  const contractors = useMemo(() => data ?? [], [data])
  const activeCount = contractors.filter((contractor) => contractor.is_active).length

  const visibleContractors = useMemo(() => {
    const search = query.trim().toLowerCase()
    return contractors.filter((contractor) => {
      const matchesStatus =
        statusFilter === 'all' || contractor.is_active === (statusFilter === 'active')
      const matchesSearch =
        !search ||
        [contractor.name, contractor.contact_name, contractor.contact_email].some((value) =>
          (value ?? '').toLowerCase().includes(search),
        )
      return matchesStatus && matchesSearch
    })
  }, [contractors, query, statusFilter])

  function replaceContractor(updated: Contractor) {
    update((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)).sort(byName),
    )
  }

  async function addContractor(input: ContractorCreateRequest) {
    const created = await createContractor(token, input)
    update((current) => [...current, created].sort(byName))
    toast.success('Contractor added')
  }

  async function saveContractor(contractor: Contractor, changes: ContractorUpdateRequest) {
    if (Object.keys(changes).length > 0) {
      replaceContractor(await updateContractor(token, contractor.id, changes))
      toast.success('Contractor updated')
    }
    setEditing(null)
  }

  async function setActive(contractor: Contractor, isActive: boolean) {
    setDeactivating(null)
    try {
      replaceContractor(await updateContractor(token, contractor.id, { is_active: isActive }))
      toast.success(isActive ? 'Contractor reactivated' : 'Contractor deactivated')
    } catch (caught) {
      toast.error(
        isActive ? 'Could not reactivate the contractor' : 'Could not deactivate the contractor',
        { description: failureReason(caught) },
      )
    }
  }

  async function removeContractor(contractor: Contractor) {
    setDeleting(null)
    try {
      await deleteContractor(token, contractor.id)
      update((current) => current.filter((item) => item.id !== contractor.id))
      toast.success('Contractor deleted')
    } catch (caught) {
      toast.error('Could not delete the contractor', { description: failureReason(caught) })
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Contractor Management"
        description="Add the recycling contractors that collect your stores' recycle bins."
        actions={<Badge variant="outline">Admin &middot; Partners</Badge>}
      />

      <LoadState
        isLoading={!data}
        error={error}
        loadingLabel="Loading contractors..."
        onRetry={retry}
      />

      {data ? (
        <>
          <AddContractorForm
            existingNames={contractors.map((contractor) => contractor.name)}
            onAdd={addContractor}
          />

          <TableCard
            title="Current contractors"
            description={`${contractors.length} ${
              contractors.length === 1 ? 'contractor' : 'contractors'
            } · ${activeCount} active`}
            actions={
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <SearchInput
                  label="Search contractors"
                  placeholder="Search contractors..."
                  value={query}
                  onChange={setQuery}
                  className="flex-1 sm:w-56 sm:flex-none"
                />
                <FilterSelect
                  label="Filter by status"
                  value={statusFilter}
                  items={statusFilterOptions}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  className="h-9 w-32 text-sm"
                />
              </div>
            }
          >
            <Table className="min-w-[560px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4 text-xs uppercase">Contractor</TableHead>
                  <TableHead className="px-4 text-xs uppercase">Contact</TableHead>
                  <TableHead className="px-4 text-xs uppercase">Status</TableHead>
                  <TableHead className="w-10 px-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContractors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {contractors.length === 0
                        ? 'No contractors yet. Add the first one above.'
                        : 'No contractors match your search.'}
                    </TableCell>
                  </TableRow>
                ) : null}
                {visibleContractors.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell className="px-4 py-3 font-medium">{contractor.name}</TableCell>
                    <TableCell className="px-4 py-3">
                      {contractor.contact_name || contractor.contact_email ? (
                        <div className="flex flex-col">
                          <span>{contractor.contact_name ?? '—'}</span>
                          {contractor.contact_email ? (
                            <span className="text-xs text-muted-foreground">
                              {contractor.contact_email}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <ContractorStatusBadge active={contractor.is_active} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${contractor.name}`}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(contractor)}>
                            Edit contractor
                          </DropdownMenuItem>
                          {contractor.is_active ? (
                            <DropdownMenuItem onSelect={() => setDeactivating(contractor)}>
                              Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setActive(contractor, true)}>
                              Reactivate
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(contractor)}
                          >
                            Delete contractor
                          </DropdownMenuItem>
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
        <EditContractorDialog
          key={editing.id}
          contractor={editing}
          onClose={() => setEditing(null)}
          onSave={(changes) => saveContractor(editing, changes)}
        />
      ) : null}
      {deactivating ? (
        <ConfirmDialog
          title={`Deactivate ${deactivating.name}?`}
          description="It can no longer be chosen for new recycle bin pickups or report imports. Its past handoffs and reports are kept, and you can reactivate it at any time."
          confirmLabel="Deactivate"
          onCancel={() => setDeactivating(null)}
          onConfirm={() => setActive(deactivating, false)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          destructive
          title={`Delete ${deleting.name}?`}
          description="Only contractors with no handoffs or reports can be deleted. Deactivate a contractor that has done work instead. This action cannot be undone."
          confirmLabel="Delete contractor"
          onCancel={() => setDeleting(null)}
          onConfirm={() => removeContractor(deleting)}
        />
      ) : null}
    </section>
  )
}
