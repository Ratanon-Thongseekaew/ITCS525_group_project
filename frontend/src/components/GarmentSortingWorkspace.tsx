import * as React from 'react'
import {
  Archive,
  ArrowRight,
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
} from 'lucide-react'

import {
  type ActiveBinsResponse,
  type BinRecord,
  type BinType,
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES = ['Tops', 'Bottoms', 'Outerwear', 'Dresses', 'Accessories', 'Other']

export function GarmentSortingWorkspace() {
  const [stats, setStats] = React.useState<SortingStatsResponse | null>(null)
  const [activeBins, setActiveBins] = React.useState<ActiveBinsResponse | null>(null)
  const [allBins, setAllBins] = React.useState<BinRecord[]>([])
  const [recentGarments, setRecentGarments] = React.useState<GarmentItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sortingInProgress, setSortingInProgress] = React.useState(false)

  // Intake form state
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Tops')
  const [weightKg, setWeightKg] = React.useState<string>('')
  const [notes, setNotes] = React.useState<string>('')
  const [lastFeedback, setLastFeedback] = React.useState<{
    type: 'resale' | 'recycle'
    message: string
  } | null>(null)

  // Bin filter & creation modal state
  const [binFilter, setBinFilter] = React.useState<
    'all' | 'active' | 'closed' | 'resale' | 'recycle'
  >('all')
  const [showNewBinModal, setShowNewBinModal] = React.useState(false)
  const [newBinType, setNewBinType] = React.useState<BinType>('resale')
  const [newBinCode, setNewBinCode] = React.useState('')
  const [newBinCapacity, setNewBinCapacity] = React.useState('50')
  const [newBinNotes, setNewBinNotes] = React.useState('')
  const [closingBinId, setClosingBinId] = React.useState<string | null>(null)
  const [closeNotes, setCloseNotes] = React.useState('')

  const refreshData = React.useCallback(async () => {
    try {
      setLoading(true)
      const [statsData, activeBinsData, binsData, recentData] = await Promise.all([
        getSortingStats(),
        getActiveBins(),
        getBins(),
        getRecentGarments(10),
      ])
      setStats(statsData)
      setActiveBins(activeBinsData)
      setAllBins(binsData)
      setRecentGarments(recentData)
    } catch (err) {
      console.error('Failed to load sorting workspace data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let ignore = false
    async function loadInitialData() {
      try {
        const [statsData, activeBinsData, binsData, recentData] = await Promise.all([
          getSortingStats(),
          getActiveBins(),
          getBins(),
          getRecentGarments(10),
        ])
        if (!ignore) {
          setStats(statsData)
          setActiveBins(activeBinsData)
          setAllBins(binsData)
          setRecentGarments(recentData)
          setLoading(false)
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load initial sorting workspace data:', err)
          setLoading(false)
        }
      }
    }
    void loadInitialData()
    return () => {
      ignore = true
    }
  }, [])

  // Handle Quick Sort submission
  const handleSort = React.useCallback(
    async (condition: GarmentCondition) => {
      if (sortingInProgress) return
      try {
        setSortingInProgress(true)
        const parsedWeight = weightKg.trim() ? parseFloat(weightKg) : undefined
        const response = await sortGarment({
          condition,
          category: selectedCategory,
          weight_kg: Number.isFinite(parsedWeight) ? parsedWeight : undefined,
          notes: notes.trim() || undefined,
        })

        setLastFeedback({
          type: condition === 'good_reusable' ? 'resale' : 'recycle',
          message: response.message,
        })

        // Reset optional inputs
        setWeightKg('')
        setNotes('')

        // Refresh data
        await refreshData()
      } catch (err) {
        console.error('Failed to sort garment:', err)
        setLastFeedback({
          type: 'recycle',
          message: 'Sorting failed. Please check network or try again.',
        })
      } finally {
        setSortingInProgress(false)
      }
    },
    [notes, refreshData, selectedCategory, sortingInProgress, weightKg],
  )

  // Ref to always access the latest handleSort in event listener
  const handleSortRef = React.useRef(handleSort)
  React.useEffect(() => {
    handleSortRef.current = handleSort
  })

  // Keyboard shortcut listener for ultra-fast intake (R/1 = Resale, C/2 = Recycle)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return
      }
      if (e.key === 'r' || e.key === 'R' || e.key === '1') {
        e.preventDefault()
        void handleSortRef.current('good_reusable')
      } else if (e.key === 'c' || e.key === 'C' || e.key === '2') {
        e.preventDefault()
        void handleSortRef.current('worn_recyclable')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Create new bin
  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createBin({
        bin_type: newBinType,
        bin_code: newBinCode.trim() || undefined,
        max_capacity: parseInt(newBinCapacity, 10) || 50,
        notes: newBinNotes.trim() || undefined,
      })
      setShowNewBinModal(false)
      setNewBinCode('')
      setNewBinNotes('')
      await refreshData()
    } catch (err) {
      console.error('Failed to create bin:', err)
    }
  }

  // Close bin
  const handleCloseBin = async (binId: string) => {
    try {
      await closeBin(binId, closeNotes.trim() || undefined)
      setClosingBinId(null)
      setCloseNotes('')
      await refreshData()
    } catch (err) {
      console.error('Failed to close bin:', err)
    }
  }

  // Filtered bins list
  const filteredBins = React.useMemo(() => {
    return allBins.filter((bin) => {
      if (binFilter === 'active') return bin.status === 'active'
      if (binFilter === 'closed') return bin.status === 'closed'
      if (binFilter === 'resale') return bin.bin_type === 'resale'
      if (binFilter === 'recycle') return bin.bin_type === 'recycle'
      return true
    })
  }, [allBins, binFilter])

  return (
    <div className="space-y-6">
      {/* Header with feature title and test-compatible heading */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Store Operations • Garment Counter Intake
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Garment Sorting & Bin Records
          </h1>
          <h2 className="text-sm font-medium text-slate-500">Your work, clearly organized.</h2>
          <p className="text-xs text-slate-400 mt-0.5">Rapid counter triage and bin tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshData()}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowNewBinModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            New Bin Record
          </Button>
        </div>
      </div>

      {/* KPI / Session Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Total Sorted Today</span>
              <Shirt className="size-4 text-slate-400" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {stats?.total_sorted_today ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-slate-500">
            Recorded during current shift
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium">
              <span>Resale Capture Rate</span>
              <TrendingUp className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-700">
              {stats?.resale_percentage ?? 0}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-slate-500">
            {stats?.resale_count ?? 0} garments saved for direct resale
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium text-emerald-800">
              <span>Active Resale Bin</span>
              <Sparkles className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-emerald-950">
              {activeBins?.resale_bin?.bin_code ?? 'No active bin'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-emerald-700">
            {activeBins?.resale_bin
              ? `${activeBins.resale_bin.item_count} / ${activeBins.resale_bin.max_capacity} items (${activeBins.resale_bin.total_weight_kg} kg)`
              : 'Click New Bin to create'}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-medium text-amber-800">
              <span>Active Recycling Bin</span>
              <Recycle className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-xl font-bold text-amber-950">
              {activeBins?.recycle_bin?.bin_code ?? 'No active bin'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-amber-700">
            {activeBins?.recycle_bin
              ? `${activeBins.recycle_bin.item_count} / ${activeBins.recycle_bin.max_capacity} items (${activeBins.recycle_bin.total_weight_kg} kg)`
              : 'Click New Bin to create'}
          </CardContent>
        </Card>
      </div>

      {/* Main Section: Quick-Tap Intake Counter */}
      <Card className="border-2 border-slate-300 shadow-md">
        <CardHeader className="bg-slate-50/70 pb-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl text-slate-900 flex items-center gap-2">
                <Shirt className="size-5 text-emerald-600" />
                Quick-Tap Garment Intake Counter
              </CardTitle>
              <CardDescription>
                Designed for sub-10-second condition triage. Tap button or use keyboard shortcuts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200">
              <Clock className="size-3.5 text-slate-400" />
              <span>Target: &lt;10s / garment</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Recent Action Feedback Alert */}
          {lastFeedback && (
            <div
              className={`flex items-center gap-2.5 p-3 rounded-lg text-sm border font-medium transition-all ${
                lastFeedback.type === 'resale'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{lastFeedback.message}</span>
            </div>
          )}

          {/* Optional Category Chips */}
          <div>
            <Label className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
              Garment Category (Optional)
            </Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    selectedCategory === cat
                      ? 'bg-slate-900 !text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick-Tap Buttons: Resale vs Recycle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Button 1: Good / Reusable (Resale) */}
            <button
              type="button"
              disabled={sortingInProgress}
              onClick={() => void handleSort('good_reusable')}
              className="group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-emerald-500 bg-emerald-600 !text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:opacity-50"
            >
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-800/80 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                Key: [R] or [1]
              </div>
              <Sparkles className="size-10 mb-2 transition-transform group-hover:scale-110" />
              <span className="text-2xl font-extrabold tracking-tight">Good / Reusable</span>
              <span className="text-xs text-emerald-100 mt-1 font-medium">
                Route directly to Resale Bin ({activeBins?.resale_bin?.bin_code ?? 'Auto'})
              </span>
            </button>

            {/* Button 2: Worn / Recyclable (Recycle) */}
            <button
              type="button"
              disabled={sortingInProgress}
              onClick={() => void handleSort('worn_recyclable')}
              className="group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-amber-600 bg-amber-600 !text-white hover:bg-amber-700 active:scale-[0.98] transition-all shadow-md focus:outline-none focus:ring-4 focus:ring-amber-300 disabled:opacity-50"
            >
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-800/80 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded">
                Key: [C] or [2]
              </div>
              <Recycle className="size-10 mb-2 transition-transform group-hover:scale-110" />
              <span className="text-2xl font-extrabold tracking-tight">Worn / Recyclable</span>
              <span className="text-xs text-amber-100 mt-1 font-medium">
                Route to Contractor Recycling Bin ({activeBins?.recycle_bin?.bin_code ?? 'Auto'})
              </span>
            </button>
          </div>

          {/* Collapsible / Optional Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <Label htmlFor="weight-input" className="text-xs text-slate-600">
                Estimated Weight (kg, optional)
              </Label>
              <div className="relative mt-1">
                <Scale className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
                <Input
                  id="weight-input"
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="e.g. 0.40"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes-input" className="text-xs text-slate-600">
                Staff Note (optional)
              </Label>
              <Input
                id="notes-input"
                placeholder="e.g. Designer tag, minor stain"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 text-xs h-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Bins Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Resale Bin Progress */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Direct Resale Bin
              </span>
              <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                {activeBins?.resale_bin?.bin_code ?? 'None Active'}
              </CardTitle>
            </div>
            {activeBins?.resale_bin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClosingBinId(activeBins.resale_bin!.id)}
                className="text-xs border-slate-300 hover:bg-slate-100 flex items-center gap-1"
              >
                <Archive className="size-3.5 text-slate-600" />
                Seal / Close Bin
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            {activeBins?.resale_bin ? (
              <>
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>
                    Capacity: {activeBins.resale_bin.item_count} /{' '}
                    {activeBins.resale_bin.max_capacity} items
                  </span>
                  <span>
                    {Math.round(
                      (activeBins.resale_bin.item_count / activeBins.resale_bin.max_capacity) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (activeBins.resale_bin.item_count / activeBins.resale_bin.max_capacity) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Total Weight: {activeBins.resale_bin.total_weight_kg} kg • Destined for Feature 3
                  Resale Processing
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-3">
                No active resale bin. Sort an item or click "New Bin Record" to start one.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recycling Bin Progress */}
        <Card className="border-slate-200">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Recycling Bin
              </span>
              <CardTitle className="text-lg font-bold text-slate-900 mt-1">
                {activeBins?.recycle_bin?.bin_code ?? 'None Active'}
              </CardTitle>
            </div>
            {activeBins?.recycle_bin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClosingBinId(activeBins.recycle_bin!.id)}
                className="text-xs border-slate-300 hover:bg-slate-100 flex items-center gap-1"
              >
                <Archive className="size-3.5 text-slate-600" />
                Seal / Close Bin
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            {activeBins?.recycle_bin ? (
              <>
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>
                    Capacity: {activeBins.recycle_bin.item_count} /{' '}
                    {activeBins.recycle_bin.max_capacity} items
                  </span>
                  <span>
                    {Math.round(
                      (activeBins.recycle_bin.item_count / activeBins.recycle_bin.max_capacity) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (activeBins.recycle_bin.item_count / activeBins.recycle_bin.max_capacity) *
                          100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Total Weight: {activeBins.recycle_bin.total_weight_kg} kg • Destined for Feature 4
                  Contractor Handoff
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-3">
                No active recycling bin. Sort an item or click "New Bin Record" to start one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bin Records List & Management Table */}
      <Card className="border-slate-200">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package className="size-4 text-emerald-600" />
                Bin Records & History
              </CardTitle>
              <CardDescription>
                Track open and completed bins for downstream resale and contractor handoff.
              </CardDescription>
            </div>
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'all', label: 'All Bins' },
                  { id: 'active', label: 'Active' },
                  { id: 'closed', label: 'Closed' },
                  { id: 'resale', label: 'Resale' },
                  { id: 'recycle', label: 'Recycle' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setBinFilter(f.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    binFilter === f.id
                      ? 'bg-slate-900 !text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Bin Code</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Item Count</th>
                  <th className="py-2.5 px-4">Weight (kg)</th>
                  <th className="py-2.5 px-4">Created</th>
                  <th className="py-2.5 px-4">Closed</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      No bins found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredBins.map((bin) => (
                    <tr key={bin.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{bin.bin_code}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            bin.bin_type === 'resale'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {bin.bin_type === 'resale' ? 'Direct Resale' : 'Recycling'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            bin.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {bin.status === 'active' ? 'Active / Open' : 'Closed / Sealed'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {bin.item_count} / {bin.max_capacity}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{bin.total_weight_kg} kg</td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(bin.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {bin.closed_at
                          ? new Date(bin.closed_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {bin.status === 'active' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setClosingBinId(bin.id)}
                            className="h-7 text-[11px] px-2 text-slate-700 hover:text-slate-900"
                          >
                            Close Bin
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Live Recent Counter Log */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Clock className="size-4 text-slate-500" />
            Recent Garments Intake Feed
          </CardTitle>
          <CardDescription className="text-xs">
            Audit trail of recently scanned and sorted garments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-1">
          <div className="space-y-2">
            {recentGarments.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No garments sorted yet.</p>
            ) : (
              recentGarments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block size-2 rounded-full ${
                        item.condition === 'good_reusable' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="font-semibold text-slate-800">{item.category}</span>
                    <span className="text-slate-500">
                      {item.condition === 'good_reusable' ? 'Good / Reusable' : 'Worn / Recyclable'}
                    </span>
                    {item.weight_kg && (
                      <span className="text-slate-400 text-[11px]">({item.weight_kg} kg)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {item.bin_code}
                    </span>
                    <span className="text-[11px]">
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal: New Bin Record */}
      {showNewBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Create New Bin Record</CardTitle>
              <CardDescription>Register an empty bin for counter sorting.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateBin}>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Bin Destination Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setNewBinType('resale')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                        newBinType === 'resale'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Sparkles className="size-4" />
                      Direct Resale
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBinType('recycle')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 ${
                        newBinType === 'recycle'
                          ? 'border-amber-600 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Recycle className="size-4" />
                      Recycling
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="modal-bincode" className="text-xs">
                    Custom Bin Code (optional)
                  </Label>
                  <Input
                    id="modal-bincode"
                    placeholder={`e.g. BIN-${newBinType === 'resale' ? 'RS' : 'RC'}-005`}
                    value={newBinCode}
                    onChange={(e) => setNewBinCode(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Leave blank to auto-generate sequentially.
                  </p>
                </div>

                <div>
                  <Label htmlFor="modal-capacity" className="text-xs">
                    Target Max Capacity (items)
                  </Label>
                  <Input
                    id="modal-capacity"
                    type="number"
                    min="1"
                    max="500"
                    value={newBinCapacity}
                    onChange={(e) => setNewBinCapacity(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="modal-notes" className="text-xs">
                    Notes / Location (optional)
                  </Label>
                  <Input
                    id="modal-notes"
                    placeholder="e.g. Counter station 2"
                    value={newBinNotes}
                    onChange={(e) => setNewBinNotes(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 p-4 pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewBinModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Create Bin
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Close / Seal Bin Confirmation */}
      {closingBinId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <Card className="w-full max-w-md shadow-2xl border-slate-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Archive className="size-5 text-amber-600" />
                Seal and Close Bin
              </CardTitle>
              <CardDescription>
                Mark this bin as completed. It will no longer accept new items and becomes ready for
                downstream processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="close-notes" className="text-xs">
                  Closure Notes (optional)
                </Label>
                <Input
                  id="close-notes"
                  placeholder="e.g. Full capacity reached, shifted to backroom"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </CardContent>
            <div className="flex items-center justify-end gap-2 p-4 pt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClosingBinId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleCloseBin(closingBinId)}
                className="bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-1.5"
              >
                <ArrowRight className="size-4" />
                Confirm & Seal
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
