import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  RefreshCw,
} from 'lucide-react'

import {
  fetchContractorReportOptions,
  importContractorReport,
  parseAndValidateContractorFile,
  validateContractorReport,
  type ContractorReportImportResponse,
  type ContractorReportOptionItem,
} from '@/api'

interface ReportRow {
  row: number
  binId: string
  contractor: string
  storeWeight: number
  reportedWeight: number
  upcycledKg: number
  fibreToFibreKg: number
  downcycledKg: number
  exportedKg: number
  landfilledKg: number
  energyRecoveryKg: number
  uncategorizedKg: number
  status: 'Verified' | 'Warning' | 'Error'
  errorDetail?: string
}

const DEFAULT_DEMO_ROWS: ReportRow[] = [
  {
    row: 1,
    binId: 'BIN-C-0047',
    contractor: 'Dashboard GreenLoop Recycling',
    storeWeight: 12.3,
    reportedWeight: 12.1,
    upcycledKg: 4.2,
    fibreToFibreKg: 4.8,
    downcycledKg: 1.8,
    exportedKg: 0.6,
    landfilledKg: 0.2,
    energyRecoveryKg: 0.2,
    uncategorizedKg: 0.3,
    status: 'Verified',
  },
  {
    row: 2,
    binId: 'BIN-C-0046',
    contractor: 'ReWeave Recyclers',
    storeWeight: 15.1,
    reportedWeight: 10.0,
    upcycledKg: 5.3,
    fibreToFibreKg: 2.7,
    downcycledKg: 1.0,
    exportedKg: 0.6,
    landfilledKg: 0.4,
    energyRecoveryKg: 0.6,
    uncategorizedKg: 0,
    status: 'Error',
    errorDetail: 'Disposition weights exceed received weight by 0.600 kg.',
  },
  {
    row: 3,
    binId: 'MISSING_ID',
    contractor: 'Loopfibre Co.',
    storeWeight: 14.0,
    reportedWeight: 13.9,
    upcycledKg: 3.5,
    fibreToFibreKg: 4.5,
    downcycledKg: 3.0,
    exportedKg: 2.0,
    landfilledKg: 0.9,
    energyRecoveryKg: 0,
    uncategorizedKg: 0,
    status: 'Error',
    errorDetail: 'Missing or invalid Bin ID format.',
  },
  {
    row: 4,
    binId: 'BIN-C-0042',
    contractor: 'Dashboard GreenLoop Recycling',
    storeWeight: 16.5,
    reportedWeight: 16.0,
    upcycledKg: 4.5,
    fibreToFibreKg: 4.0,
    downcycledKg: 3.2,
    exportedKg: 2.5,
    landfilledKg: 1.0,
    energyRecoveryKg: 0.3,
    uncategorizedKg: 0.5,
    status: 'Warning',
    errorDetail: 'Uncategorized remainder: 0.50 kg.',
  },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })
}

export default function ContractorReportImport() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const [sites, setSites] = useState<ContractorReportOptionItem[]>([])
  const [contractors, setContractors] = useState<ContractorReportOptionItem[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<number>(1)
  const [selectedContractor, setSelectedContractor] = useState<string>(
    'Dashboard GreenLoop Recycling',
  )
  const [reportMonth, setReportMonth] = useState<string>('2026-11')

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [validatedRows, setValidatedRows] = useState<ReportRow[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ContractorReportImportResponse | null>(null)

  useEffect(() => {
    let active = true
    fetchContractorReportOptions()
      .then((data) => {
        if (!active) return
        setSites(data.sites)
        setContractors(data.contractors)
        if (data.sites.length > 0) {
          setSelectedSiteId(data.sites[0].id)
        }
        if (data.contractors.length > 0) {
          setSelectedContractor(data.contractors[0].name)
        }
      })
      .catch(() => {
        // Fallback options remain usable if offline
      })
    return () => {
      active = false
    }
  }, [])

  const handleFileSelected = async (file: File) => {
    setIsProcessing(true)
    setValidationError(null)
    setSaveError(null)
    try {
      const base64 = await fileToBase64(file)
      const parsed = await parseAndValidateContractorFile(file.name, base64)
      const mapped: ReportRow[] = parsed.rows.map((r) => ({
        row: r.row,
        binId: r.bin_id,
        contractor: r.contractor,
        storeWeight: r.store_weight_kg,
        reportedWeight: r.received_kg,
        upcycledKg: r.dispositions.upcycled_kg,
        fibreToFibreKg: r.dispositions.fibre_to_fibre_kg,
        downcycledKg: r.dispositions.downcycled_kg,
        exportedKg: r.dispositions.exported_kg,
        landfilledKg: r.dispositions.landfilled_kg,
        energyRecoveryKg: r.dispositions.incinerated_energy_recovery_kg,
        uncategorizedKg: r.uncategorized_weight_kg,
        status: r.status,
        errorDetail: r.errors.join(' '),
      }))
      setValidatedRows(mapped)
      setUploadedFileName(parsed.filename)
      setStep(2)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'The uploaded file could not be validated.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFileSelected(file)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFileSelected(file)
    }
  }

  const handleStartSampleReview = async () => {
    setIsProcessing(true)
    setValidationError(null)
    setSaveError(null)
    try {
      const response = await validateContractorReport(
        DEFAULT_DEMO_ROWS.map((row) => ({
          row: row.row,
          received_kg: row.reportedWeight,
          dispositions: {
            upcycled_kg: row.upcycledKg,
            fibre_to_fibre_kg: row.fibreToFibreKg,
            downcycled_kg: row.downcycledKg,
            exported_kg: row.exportedKg,
            landfilled_kg: row.landfilledKg,
            incinerated_energy_recovery_kg: row.energyRecoveryKg,
          },
        })),
      )
      const merged = DEFAULT_DEMO_ROWS.map((row) => {
        const res = response.rows.find((item) => item.row === row.row)
        return {
          ...row,
          uncategorizedKg: res?.uncategorized_weight_kg ?? row.uncategorizedKg,
          status: res && !res.is_valid ? ('Error' as const) : row.status,
          errorDetail: res && !res.is_valid ? res.errors.join(' ') : row.errorDetail,
        }
      })
      setValidatedRows(merged)
      setUploadedFileName(`contractor_report_${reportMonth}_sample.csv`)
      setStep(2)
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'The report could not be validated.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadTemplate = () => {
    const csvContent = [
      'bin_id,contractor,store_weight_kg,received_kg,upcycled_kg,fibre_to_fibre_kg,downcycled_kg,exported_kg,landfilled_kg,incinerated_energy_recovery_kg',
      `DASH-BKK-2026-11-RECYCLE,${selectedContractor},24.0,24.0,4.0,10.0,4.5,2.0,1.0,2.5`,
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contractor_monthly_report_template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const savableRows = validatedRows.filter((row) => row.status !== 'Error')

  const handleSaveRecords = async () => {
    if (savableRows.length === 0) {
      setSaveError('No valid rows available to import. Please fix the rejected rows first.')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await importContractorReport({
        site_id: selectedSiteId,
        contractor_name: selectedContractor,
        report_month: reportMonth,
        source_filename: uploadedFileName ?? `report_${reportMonth}.csv`,
        rows: savableRows.map((row) => ({
          row: row.row,
          bin_id: row.binId,
          contractor: row.contractor,
          store_weight_kg: row.storeWeight,
          received_kg: row.reportedWeight,
          dispositions: {
            upcycled_kg: row.upcycledKg,
            fibre_to_fibre_kg: row.fibreToFibreKg,
            downcycled_kg: row.downcycledKg,
            exported_kg: row.exportedKg,
            landfilled_kg: row.landfilledKg,
            incinerated_energy_recovery_kg: row.energyRecoveryKg,
          },
        })),
      })
      setImportResult(response)
      setStep(3)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save contractor report.')
    } finally {
      setIsSaving(false)
    }
  }

  const totalRows = validatedRows.length
  const verifiedCount = validatedRows.filter((row) => row.status === 'Verified').length
  const warningCount = validatedRows.filter((row) => row.status === 'Warning').length
  const errorCount = validatedRows.filter((row) => row.status === 'Error').length
  const selectedSiteLabel =
    sites.find((s) => s.id === selectedSiteId)?.name ?? `Site #${selectedSiteId}`

  return (
    <div className="w-full space-y-6">
      {/* 步骤条 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { num: 1, title: 'Step 1: Upload File', desc: 'CSV, XLSX + Site & Month' },
          { num: 2, title: 'Step 2: Review 6 Categories', desc: 'Verify weights & rules' },
          { num: 3, title: 'Step 3: Save Report', desc: 'Persist to MySQL database' },
        ].map((s) => {
          const isActive = step === s.num
          const isDone = step > s.num
          return (
            <div
              key={s.num}
              style={{
                backgroundColor: isActive ? '#047857' : isDone ? '#ecfdf5' : '#ffffff',
                borderColor: isActive ? '#047857' : isDone ? '#a7f3d0' : '#e2e8f0',
              }}
              className="p-3.5 rounded-xl border transition-all flex items-center gap-3 shadow-sm"
            >
              <div
                style={{
                  backgroundColor: isActive ? '#ffffff' : isDone ? '#059669' : '#f1f5f9',
                  color: isActive ? '#047857' : isDone ? '#ffffff' : '#64748b',
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
              >
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <p
                  style={{
                    color: isActive ? '#ffffff' : isDone ? '#064e3b' : '#334155',
                  }}
                  className="text-xs font-bold leading-tight"
                >
                  {s.title}
                </p>
                <p
                  style={{
                    color: isActive ? '#d1fae5' : isDone ? '#047857' : '#94a3b8',
                  }}
                  className="text-[10px] mt-0.5"
                >
                  {s.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 主卡片容器 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        {/* Step 1: Upload File */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-900">Upload File</h3>

            {/* 门店、月份、承包商选择栏 (CR #16 Multi-site + Period) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="site-select" className="text-xs font-semibold text-slate-700 block">
                  Sorting Center (Site)
                </label>
                <select
                  id="site-select"
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {sites.length > 0 ? (
                    sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value={1}>Bangkok Sorting Center (DASH-BKK)</option>
                      <option value={2}>Chiang Mai Sorting Center (DASH-CNX)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="report-month-select"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Report Month
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    aria-label="Report Year"
                    value={reportMonth.split('-')[0] || '2026'}
                    onChange={(e) => {
                      const monthPart = reportMonth.split('-')[1] || '11'
                      setReportMonth(`${e.target.value}-${monthPart}`)
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                  <select
                    id="report-month-select"
                    value={reportMonth.split('-')[1] || '11'}
                    onChange={(e) => {
                      const yearPart = reportMonth.split('-')[0] || '2026'
                      setReportMonth(`${yearPart}-${e.target.value}`)
                    }}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="01">January</option>
                    <option value="02">February</option>
                    <option value="03">March</option>
                    <option value="04">April</option>
                    <option value="05">May</option>
                    <option value="06">June</option>
                    <option value="07">July</option>
                    <option value="08">August</option>
                    <option value="09">September</option>
                    <option value="10">October</option>
                    <option value="11">November</option>
                    <option value="12">December</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="contractor-select"
                  className="text-xs font-semibold text-slate-700 block"
                >
                  Contractor
                </label>
                <select
                  id="contractor-select"
                  value={selectedContractor}
                  onChange={(e) => setSelectedContractor(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {contractors.length > 0 ? (
                    contractors.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Dashboard GreenLoop Recycling">
                        Dashboard GreenLoop Recycling
                      </option>
                      <option value="Dashboard Circular Fibre Co.">
                        Dashboard Circular Fibre Co.
                      </option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* 上传拖拽区域 */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-8 md:p-14 text-center transition bg-emerald-50/20"
            >
              {isProcessing ? (
                <div className="py-6 space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Parsing spreadsheet & validating 6 disposition categories...
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center mx-auto shadow-xs">
                    <UploadCloud className="w-6 h-6 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Drag and drop file here or</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ backgroundColor: '#047857', color: '#ffffff' }}
                      className="mt-3 px-5 py-2 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span style={{ color: '#ffffff' }}>Choose file</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {validationError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            ) : null}

            {/* 文件限制说明 */}
            <div className="flex flex-col sm:flex-row justify-between text-[11px] text-slate-400 gap-1 border-b border-slate-100 pb-4">
              <span>Supported Formats: CSV, XLSX (6 EPR disposition categories)</span>
              <div className="flex gap-4">
                <span>Maximum File: 1</span>
                <span>Maximum File Size: 100MB</span>
              </div>
            </div>

            {/* 样例模板下载 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 gap-3">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Table Example Template</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Download the CSV template containing all 6 required EPR disposition categories
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-700" />
                <span>Download</span>
              </button>
            </div>

            {/* 底部按钮条 */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={() =>
                  alert(
                    'Formatting guide: Include bin_id, contractor, received_kg, and all 6 disposition categories (upcycled_kg, fibre_to_fibre_kg, downcycled_kg, exported_kg, landfilled_kg, incinerated_energy_recovery_kg).',
                  )
                }
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Formatting Guide</span>
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/manager')}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartSampleReview}
                  style={{ backgroundColor: '#047857', color: '#ffffff' }}
                  className="px-5 py-2 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span style={{ color: '#ffffff' }}>Next</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review Report */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Review Report Validation</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Site: <span className="font-semibold text-slate-700">{selectedSiteLabel}</span> |
                  Month: <span className="font-semibold text-slate-700">{reportMonth}</span> | File:{' '}
                  <span className="font-semibold text-slate-700">{uploadedFileName}</span> (
                  {selectedContractor})
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full self-start sm:self-auto border border-emerald-200">
                Ready for Review
              </span>
            </div>

            {/* KPI 指标卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase">Total Rows</span>
                <p className="text-2xl font-black text-slate-900 mt-0.5">{totalRows}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-800 uppercase">
                  Verified Records
                </span>
                <p className="text-2xl font-black text-emerald-800 mt-0.5">{verifiedCount}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-800 uppercase">
                  Flagged Warnings
                </span>
                <p className="text-2xl font-black text-amber-800 mt-0.5">{warningCount}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-800 uppercase">
                  Rejected Errors
                </span>
                <p className="text-2xl font-black text-rose-800 mt-0.5">{errorCount}</p>
              </div>
            </div>

            {/* 校验明细表格 */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3">Row</th>
                    <th className="py-3 px-3">Bin ID</th>
                    <th className="py-3 px-3">Contractor</th>
                    <th className="py-3 px-3">Store Wt</th>
                    <th className="py-3 px-3">Reported Wt</th>
                    <th className="py-3 px-3 text-emerald-800 bg-emerald-100/60 font-bold">
                      Upcycled
                    </th>
                    <th className="py-3 px-3 text-blue-800 bg-blue-100/60 font-bold">
                      Fibre-to-fibre
                    </th>
                    <th className="py-3 px-3 text-amber-800 bg-amber-100/60 font-bold">
                      Downcycled
                    </th>
                    <th className="py-3 px-3 text-purple-800 bg-purple-100/60 font-bold">
                      Exported
                    </th>
                    <th className="py-3 px-3 text-rose-800 bg-rose-100/60 font-bold">Landfilled</th>
                    <th className="bg-orange-100/60 py-3 px-3 font-bold text-orange-800">
                      Incinerated with energy recovery
                    </th>
                    <th className="bg-slate-200/60 py-3 px-3 font-bold text-slate-700">
                      Uncategorized
                    </th>
                    <th className="py-3 px-3">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validatedRows.map((r) => (
                    <tr
                      key={r.row}
                      className={
                        r.status === 'Error'
                          ? 'bg-rose-50/50'
                          : r.status === 'Warning'
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50'
                      }
                    >
                      <td className="py-3 px-3 text-slate-400 font-bold">{r.row}</td>
                      <td
                        className={`py-3 px-3 font-mono font-bold ${
                          r.binId === 'MISSING_ID' ? 'text-rose-600 underline' : 'text-slate-900'
                        }`}
                      >
                        {r.binId}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{r.contractor}</td>
                      <td className="py-3 px-3 text-slate-600">{r.storeWeight} kg</td>
                      <td className="py-3 px-3 text-slate-900 font-bold">{r.reportedWeight} kg</td>
                      <td className="py-3 px-3 text-emerald-800 font-bold bg-emerald-50/30">
                        {r.upcycledKg} kg
                      </td>
                      <td className="py-3 px-3 text-blue-800 font-bold bg-blue-50/30">
                        {r.fibreToFibreKg} kg
                      </td>
                      <td className="py-3 px-3 text-amber-800 font-bold bg-amber-50/30">
                        {r.downcycledKg} kg
                      </td>
                      <td className="py-3 px-3 text-purple-800 font-bold bg-purple-50/30">
                        {r.exportedKg} kg
                      </td>
                      <td className="py-3 px-3 text-rose-800 font-bold bg-rose-50/30">
                        {r.landfilledKg} kg
                      </td>
                      <td className="bg-orange-50/30 py-3 px-3 font-bold text-orange-800">
                        {r.energyRecoveryKg} kg
                      </td>
                      <td className="bg-slate-50 py-3 px-3 font-bold text-slate-700">
                        {r.uncategorizedKg.toFixed(1)} kg
                      </td>
                      <td className="py-3 px-3">
                        {r.status === 'Verified' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Verified</span>
                          </span>
                        )}
                        {r.status === 'Warning' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              <span>Flagged</span>
                            </span>
                            <p className="text-[10px] text-amber-800 font-medium">
                              {r.errorDetail}
                            </p>
                          </div>
                        )}
                        {r.status === 'Error' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-700" />
                              <span>Rejected</span>
                            </span>
                            <p className="text-[10px] text-rose-700 font-bold">{r.errorDetail}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {saveError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{saveError}</span>
              </div>
            ) : null}

            {/* 操作栏 */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-3 gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline self-start sm:self-auto cursor-pointer"
              >
                Back to Upload
              </button>
              <button
                type="button"
                disabled={isSaving || savableRows.length === 0}
                onClick={() => void handleSaveRecords()}
                style={{ backgroundColor: '#047857', color: '#ffffff' }}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span style={{ color: '#ffffff' }}>
                  {isSaving
                    ? 'Saving to Database...'
                    : `Save Valid Records (${savableRows.length})`}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Database Persistence Completed */}
        {step === 3 && (
          <div className="p-8 md:p-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900">Report Saved to Database</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {importResult?.message ??
                  'Verified rows have been persisted to MySQL and linked to the compliance dashboard.'}
              </p>
              {importResult ? (
                <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3 mt-2">
                  {importResult.site_name} • Report #{importResult.report_id} •{' '}
                  {importResult.imported_rows} row(s) •{' '}
                  {importResult.total_categorized_weight_kg.toFixed(2)} kg recorded
                </p>
              ) : null}
            </div>
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/manager/compliance-dashboard')}
                style={{ backgroundColor: '#047857', color: '#ffffff' }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg shadow-sm transition hover:opacity-90 cursor-pointer"
              >
                <span style={{ color: '#ffffff' }}>View Compliance Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportResult(null)
                  setStep(1)
                }}
                style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg shadow-sm transition hover:opacity-90 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-white" />
                <span style={{ color: '#ffffff' }}>Import Another Report</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
