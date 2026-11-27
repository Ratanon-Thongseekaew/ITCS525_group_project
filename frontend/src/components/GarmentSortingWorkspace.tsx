import * as React from 'react'
import {
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Recycle,
  RefreshCw,
  Scale,
  Shirt,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react'

import {
  type ActiveBinsResponse,
  type BinRecord,
  closeBin,
  createBin,
  getActiveBins,
  getBins,
  getRecentGarments,
  getSortingStats,
  type GarmentCondition,
  type GarmentItem,
  type SortingStatsResponse,
  sortGarment,
} from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/LoadState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { TableCard } from '@/components/TableCard'
import { BinProgressCard } from '@/components/staff/BinProgressCard'
import { StaffAccountBar } from '@/components/staff/StaffAccountBar'
import { NewBinDialog, type NewBinValues } from '@/components/staff/NewBinDialog'
import { SealBinDialog } from '@/components/staff/SealBinDialog'
import { SortActionButton } from '@/components/staff/SortActionButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BIN_STATUS_BADGE_VARIANTS, BIN_TYPE_TONES } from '@/lib/bin-type-tones'
import { useSession } from '@/lib/auth-session'
import { BIN_STATUS_LABELS, BIN_TYPE_LABELS, CONDITION_LABELS } from '@/lib/sorting-labels'
import { cn } from '@/lib/utils'

const CATEGORIES = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories', 'Other']

const FEEDBACK_TYPE_BY_CONDITION: Record<GarmentCondition, 'resale' | 'recycle' | 'repair'> = {
  good_reusable: 'resale',
  worn_recyclable: 'recycle',
  repair_upcycle: 'repair',
}

const BIN_FILTERS = [
  { id: 'all', label: 'All Bins' },
  { id: 'active', label: 'Active' },
  { id: 'closed', label: 'Sealed' },
  { id: 'resale', label: 'Resale' },
  { id: 'recycle', label: 'Recycle' },
  { id: 'repair', label: 'Repair' },
] as const

type BinFilter = (typeof BIN_FILTERS)[number]['id']

function formatTime(value: string, withSeconds = false) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  })
}

interface WorkspaceSnapshot {
  siteId: number
  stats: SortingStatsResponse
  activeBins: ActiveBinsResponse
  allBins: BinRecord[]
  recentGarments: GarmentItem[]
}

async function loadWorkspaceSnapshot(token: string, siteId: number): Promise<WorkspaceSnapshot> {
  const [stats, activeBins, allBins, recentGarments] = await Promise.all([
    getSortingStats(token, siteId),
    getActiveBins(token, siteId),
    getBins(token, siteId),
    getRecentGarments(token, siteId, 10),
  ])
  return { siteId, stats, activeBins, allBins, recentGarments }
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export function GarmentSortingWorkspace() {
  // Sorting is done by the signed-in staff member, always at their own store's site.
  const session = useSession()
  const user = session?.user ?? null
  // The API reads who is sorting from the token.
  const token = session?.token ?? ''
  const staff = user?.role === 'staff' ? user : null
  const siteId = staff?.store?.id ?? null
  // Without a store there is no site to sort at, so there is no one to act as.
  const actorId = siteId === null ? null : (staff?.id ?? null)

  const [snapshot, setSnapshot] = React.useState<WorkspaceSnapshot | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [sortingInProgress, setSortingInProgress] = React.useState(false)

  // Data from another site's staff member is never shown: it is ignored until it is reloaded.
  const current = snapshot?.siteId === siteId ? snapshot : null
  const stats = current?.stats ?? null
  const activeBins = current?.activeBins ?? null
  const allBins = React.useMemo(() => current?.allBins ?? [], [current])
  const recentGarments = current?.recentGarments ?? []
  const loading = refreshing || (siteId !== null && current === null && loadError === null)

  // Intake form state
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Tops')
  const [weightKg, setWeightKg] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [lastFeedback, setLastFeedback] = React.useState<{
    type: 'resale' | 'recycle' | 'repair'
    message: string
  } | null>(null)

  // Bin filter & creation modal state
  const [binFilter, setBinFilter] = React.useState<BinFilter>('all')
  const [showNewBinModal, setShowNewBinModal] = React.useState(false)
  const [closingBinId, setClosingBinId] = React.useState<number | null>(null)

  const refreshData = React.useCallback(async () => {
    if (siteId === null || actorId === null) return
    try {
      setRefreshing(true)
      setSnapshot(await loadWorkspaceSnapshot(token, siteId))
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load the sorting workspace.'))
    } finally {
      setRefreshing(false)
    }
  }, [actorId, siteId, token])

  React.useEffect(() => {
    if (siteId === null || actorId === null) return
    let ignore = false
    async function loadInitialData(forToken: string, forSite: number) {
      try {
        const data = await loadWorkspaceSnapshot(forToken, forSite)
        if (!ignore) {
          setSnapshot(data)
          setLoadError(null)
        }
      } catch (err) {
        if (!ignore) setLoadError(errorMessage(err, 'Failed to load the sorting workspace.'))
      }
    }
    void loadInitialData(token, siteId)
    return () => {
      ignore = true
    }
  }, [actorId, siteId, token])

  // Handle Quick Sort submission
  const handleSort = React.useCallback(
    async (condition: GarmentCondition) => {
      if (sortingInProgress || actorId === null) return
      const parsedWeight = weightKg.trim() ? parseFloat(weightKg) : undefined
      if (parsedWeight !== undefined && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
        setActionError('Enter a weight of 0 kg or more, or leave it blank.')
        return
      }
      try {
        setSortingInProgress(true)
        setActionError(null)
        const response = await sortGarment(token, {
          condition,
          category: selectedCategory,
          weight_kg: parsedWeight,
          notes: notes.trim() || undefined,
        })

        setLastFeedback({
          type: FEEDBACK_TYPE_BY_CONDITION[condition],
          message: response.message,
        })

        // Reset optional inputs
        setWeightKg('')
        setNotes('')

        // Refresh data
        await refreshData()
      } catch (err) {
        console.error('Failed to sort garment:', err)
        setLastFeedback(null)
        setActionError(errorMessage(err, 'Sorting failed. Please check network or try again.'))
      } finally {
        setSortingInProgress(false)
      }
    },
    [actorId, notes, refreshData, selectedCategory, sortingInProgress, token, weightKg],
  )

  // Ref to always access the latest handleSort in event listener
  const handleSortRef = React.useRef(handleSort)
  React.useEffect(() => {
    handleSortRef.current = handleSort
  })

  // Keyboard shortcut listener for ultra-fast intake (R/1 = Resale, C/2 = Recycle, U/3 = Repair)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A held key repeats, and Ctrl/Cmd+C or Cmd+U are browser shortcuts: neither is a sort.
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const focused = document.activeElement
      if (focused?.tagName === 'INPUT' || focused?.tagName === 'TEXTAREA') return
      // Keys typed in an open dialog belong to the dialog, even when a button there has focus.
      if (focused?.closest('[role="dialog"], [role="alertdialog"]')) return
      if (e.key === 'r' || e.key === 'R' || e.key === '1') {
        e.preventDefault()
        void handleSortRef.current('good_reusable')
      } else if (e.key === 'c' || e.key === 'C' || e.key === '2') {
        e.preventDefault()
        void handleSortRef.current('worn_recyclable')
      } else if (e.key === 'u' || e.key === 'U' || e.key === '3') {
        e.preventDefault()
        void handleSortRef.current('repair_upcycle')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Create new bin
  const handleCreateBin = async (values: NewBinValues) => {
    if (actorId === null) return
    try {
      setActionError(null)
      await createBin(token, values)
      setShowNewBinModal(false)
      await refreshData()
    } catch (err) {
      console.error('Failed to create bin:', err)
      setShowNewBinModal(false)
      setActionError(errorMessage(err, 'The bin could not be created.'))
    }
  }

  // Close bin
  const handleCloseBin = async (binId: number, closeNotes: string | undefined) => {
    if (actorId === null) return
    try {
      setActionError(null)
      await closeBin(token, binId, closeNotes)
      setClosingBinId(null)
      await refreshData()
    } catch (err) {
      console.error('Failed to close bin:', err)
      setClosingBinId(null)
      setActionError(errorMessage(err, 'The bin could not be sealed.'))
    }
  }

  // Filtered bins list
  const filteredBins = React.useMemo(() => {
    return allBins.filter((bin) => {
      if (binFilter === 'active') return bin.status === 'active'
      if (binFilter === 'closed') return bin.status !== 'active'
      if (binFilter === 'resale') return bin.bin_type === 'resale'
      if (binFilter === 'recycle') return bin.bin_type === 'recycle'
      if (binFilter === 'repair') return bin.bin_type === 'repair'
      return true
    })
  }, [allBins, binFilter])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PageHeader
          eyebrow="Store Operations • Garment Counter Intake"
          title="Garment Sorting & Bin Records"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshData()}
                disabled={loading || siteId === null}
              >
                <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden="true" />
                Refresh
              </Button>
              <Button
                size="sm"
                disabled={actorId === null}
                onClick={() => setShowNewBinModal(true)}
              >
                <Plus aria-hidden="true" />
                New Bin Record
              </Button>
            </>
          }
        />
        <h2 className="text-sm font-medium text-muted-foreground">Your work, clearly organized.</h2>
        <p className="text-xs text-muted-foreground">Rapid counter triage and bin tracking.</p>
      </div>

      <StaffAccountBar user={user} featureName="Garment Sorting" />
      {siteId === null ? (
        <EmptyState>A staff account assigned to a store is required to sort garments.</EmptyState>
      ) : null}

      {loadError || actionError ? <ErrorState message={(actionError ?? loadError)!} /> : null}

      {/* KPI / Session Metrics */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Sorted Today"
          icon={<Shirt />}
          value={stats?.total_sorted_today ?? 0}
          hint="Recorded during current shift"
        />
        <StatCard
          label="Resale Capture Rate"
          icon={<TrendingUp />}
          value={`${stats?.resale_percentage ?? 0}%`}
          hint={`${stats?.resale_count ?? 0} garments saved for direct resale`}
        />
        <StatCard
          label="Active Resale Bin"
          tone="resale"
          icon={<Sparkles />}
          value={activeBins?.resale_bin?.bin_code ?? 'No active bin'}
          hint={
            activeBins?.resale_bin
              ? `${activeBins.resale_bin.item_count} / ${activeBins.resale_bin.max_capacity} items (${activeBins.resale_bin.total_weight_kg} kg)`
              : 'Click New Bin to create'
          }
        />
        <StatCard
          label="Active Recycling Bin"
          tone="recycle"
          icon={<Recycle />}
          value={activeBins?.recycle_bin?.bin_code ?? 'No active bin'}
          hint={
            activeBins?.recycle_bin
              ? `${activeBins.recycle_bin.item_count} / ${activeBins.recycle_bin.max_capacity} items (${activeBins.recycle_bin.total_weight_kg} kg)`
              : 'Click New Bin to create'
          }
        />
      </dl>

      {/* Main Section: Quick-Tap Intake Counter */}
      <Card className="border-2">
        <CardHeader className="border-b bg-muted/50 pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shirt className="size-5 text-primary" aria-hidden="true" />
                Quick-Tap Garment Intake Counter
              </CardTitle>
              <CardDescription>
                Designed for sub-10-second condition triage. Tap button or use keyboard shortcuts.
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-background text-muted-foreground">
              <Clock aria-hidden="true" />
              Target: &lt;10s / garment
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {lastFeedback ? (
            <Alert variant={lastFeedback.type} role="status">
              <CheckCircle2 aria-hidden="true" />
              <AlertDescription className="font-medium text-current">
                {lastFeedback.message}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label
              id="garment-category-label"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Garment Category (Optional)
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={2}
              value={selectedCategory}
              onValueChange={(value) => value && setSelectedCategory(value)}
              aria-labelledby="garment-category-label"
              className="flex-wrap justify-start"
            >
              {CATEGORIES.map((category) => (
                <ToggleGroupItem
                  key={category}
                  value={category}
                  className="rounded-full px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {category}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
            <SortActionButton
              type="resale"
              icon={<Sparkles />}
              label="Good / Reusable"
              hint={`Route directly to Resale Bin (${activeBins?.resale_bin?.bin_code ?? 'Auto'})`}
              shortcut="[R] or [1]"
              disabled={sortingInProgress || actorId === null}
              onClick={() => void handleSort('good_reusable')}
            />
            <SortActionButton
              type="recycle"
              icon={<Recycle />}
              label="Worn / Recyclable"
              hint={`Route to Contractor Recycling Bin (${activeBins?.recycle_bin?.bin_code ?? 'Auto'})`}
              shortcut="[C] or [2]"
              disabled={sortingInProgress || actorId === null}
              onClick={() => void handleSort('worn_recyclable')}
            />
            <SortActionButton
              type="repair"
              icon={<Wrench />}
              label="Repair / Upcycle"
              hint={`Route to Repair Bin (${activeBins?.repair_bin?.bin_code ?? 'Auto'})`}
              shortcut="[U] or [3]"
              disabled={sortingInProgress || actorId === null}
              onClick={() => void handleSort('repair_upcycle')}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="weight-input" className="text-xs text-muted-foreground">
                Estimated Weight (kg, optional)
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Scale aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id="weight-input"
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="e.g. 0.40"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field className="gap-1.5">
              <FieldLabel htmlFor="notes-input" className="text-xs text-muted-foreground">
                Staff Note (optional)
              </FieldLabel>
              <Input
                id="notes-input"
                placeholder="e.g. Designer tag, minor stain"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Active Bins Status Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(['resale', 'recycle', 'repair'] as const).map((type) => (
          <BinProgressCard
            key={type}
            type={type}
            bin={activeBins?.[`${type}_bin`] ?? null}
            onSeal={setClosingBinId}
          />
        ))}
      </div>

      {/* Bin Records List & Management Table */}
      <TableCard
        title={
          <span className="flex items-center gap-2">
            <Package className="size-4 text-primary" aria-hidden="true" />
            Bin Records & History
          </span>
        }
        description="Track open and completed bins for downstream resale and contractor handoff."
        actions={
          <ToggleGroup
            type="single"
            size="sm"
            spacing={1}
            value={binFilter}
            onValueChange={(value) => value && setBinFilter(value as BinFilter)}
            aria-label="Filter bins"
            className="flex-wrap justify-start"
          >
            {BIN_FILTERS.map((filter) => (
              <ToggleGroupItem
                key={filter.id}
                value={filter.id}
                className="bg-muted px-2.5 text-xs text-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
              >
                {filter.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <Table className="text-xs">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4">Bin Code</TableHead>
              <TableHead className="px-4">Type</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Item Count</TableHead>
              <TableHead className="px-4">Weight (kg)</TableHead>
              <TableHead className="px-4">Created</TableHead>
              <TableHead className="px-4">Closed</TableHead>
              <TableHead className="px-4 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                  No bins found matching filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredBins.map((bin) => (
                <TableRow key={bin.id}>
                  <TableCell className="px-4 font-semibold">{bin.bin_code}</TableCell>
                  <TableCell className="px-4">
                    <Badge variant={BIN_TYPE_TONES[bin.bin_type].variant}>
                      {BIN_TYPE_LABELS[bin.bin_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant={BIN_STATUS_BADGE_VARIANTS[bin.status]}>
                      {BIN_STATUS_LABELS[bin.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 font-medium">
                    {bin.item_count} / {bin.max_capacity}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {bin.total_weight_kg} kg
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {formatTime(bin.created_at)}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {bin.closed_at || bin.ready_at
                      ? formatTime((bin.closed_at ?? bin.ready_at)!)
                      : '—'}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    {bin.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setClosingBinId(bin.id)}
                      >
                        Close Bin
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">
                        {bin.status === 'ready' ? 'Ready for handoff' : 'Sealed'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableCard>

      {/* Live Recent Counter Log */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            Recent Garments Intake Feed
          </CardTitle>
          <CardDescription className="text-xs">
            Audit trail of recently scanned and sorted garments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          {recentGarments.length === 0 ? (
            <EmptyState>No garments sorted yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {recentGarments.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/50 p-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-block size-2 rounded-full',
                        BIN_TYPE_TONES[FEEDBACK_TYPE_BY_CONDITION[item.condition]].fill,
                      )}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-foreground">{item.category}</span>
                    <span className="text-muted-foreground">
                      {CONDITION_LABELS[item.condition]}
                    </span>
                    {item.weight_kg ? (
                      <span className="text-muted-foreground">({item.weight_kg} kg)</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="rounded border bg-background px-1.5 py-0.5 font-mono">
                      {item.bin_code}
                    </span>
                    <span>{formatTime(item.created_at, true)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {showNewBinModal ? (
        <NewBinDialog
          onCreate={(values) => void handleCreateBin(values)}
          onCancel={() => setShowNewBinModal(false)}
        />
      ) : null}

      {closingBinId !== null ? (
        <SealBinDialog
          onConfirm={(closeNotes) => void handleCloseBin(closingBinId, closeNotes)}
          onCancel={() => setClosingBinId(null)}
        />
      ) : null}
    </div>
  )
}
