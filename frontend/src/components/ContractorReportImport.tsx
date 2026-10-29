import React, { useState } from 'react'
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

interface ReportRow {
  row: number
  binId: string
  contractor: string
  storeWeight: number
  reportedWeight: number
  resoldKg: number
  recycledFiberKg: number
  downcycledKg: number
  exportedKg: number
  landfilledKg: number
  status: 'Verified' | 'Warning' | 'Error'
  errorDetail?: string
}

export default function ContractorReportImport() {
  const navigate = useNavigate()
  const [step, setStep] = useState<number>(1)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [selectedContractor, setSelectedContractor] = useState<string>('Contractor 1')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const reportRows: ReportRow[] = [
    {
      row: 1,
      binId: 'BIN-C-0047',
      contractor: 'GreenSort Textiles',
      storeWeight: 12.3,
      reportedWeight: 12.1,
      resoldKg: 4.2,
      recycledFiberKg: 4.8,
      downcycledKg: 1.8,
      exportedKg: 0.9,
      landfilledKg: 0.4,
      status: 'Verified',
    },
    {
      row: 2,
      binId: 'BIN-C-0046',
      contractor: 'ReWeave Recyclers',
      storeWeight: 15.1,
      reportedWeight: 10.0,
      resoldKg: 5.3,
      recycledFiberKg: 2.7,
      downcycledKg: 1.0,
      exportedKg: 0.6,
      landfilledKg: 0.4,
      status: 'Error',
      errorDetail: 'Weight variance exceeds ±5% threshold (-5.1kg discrepancy)',
    },
    {
      row: 3,
      binId: 'MISSING_ID',
      contractor: 'Loopfibre Co.',
      storeWeight: 14.0,
      reportedWeight: 13.9,
      resoldKg: 3.5,
      recycledFiberKg: 4.5,
      downcycledKg: 3.0,
      exportedKg: 2.0,
      landfilledKg: 0.9,
      status: 'Error',
      errorDetail: 'Missing or Invalid Bin ID format',
    },
    {
      row: 4,
      binId: 'BIN-C-0042',
      contractor: 'ReWeave Recyclers',
      storeWeight: 16.5,
      reportedWeight: 15.8,
      resoldKg: 4.5,
      recycledFiberKg: 4.0,
      downcycledKg: 3.2,
      exportedKg: 2.5,
      landfilledKg: 1.6,
      status: 'Warning',
      errorDetail: 'Minor weight variance flagged (-0.7kg)',
    },
  ]

  const handleStartReview = () => {
    setIsProcessing(true)
    setTimeout(() => {
      setIsProcessing(false)
      setUploadedFileName('monthly_contractor_report_october.xlsx')
      setStep(2)
    }, 400)
  }

  const totalRows = reportRows.length
  const verifiedCount = reportRows.filter((r) => r.status === 'Verified').length
  const warningCount = reportRows.filter((r) => r.status === 'Warning').length
  const errorCount = reportRows.filter((r) => r.status === 'Error').length

  return (
    <div className="w-full space-y-6">
      {/* 步骤条 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { num: 1, title: 'Step 1: Upload File', desc: 'CSV, XLS, XLSX' },
          { num: 2, title: 'Step 2: Review 5 Categories', desc: 'Verify weights & rules' },
          { num: 3, title: 'Step 3: Save Report', desc: 'Finalize & record' },
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

            {/* 上传拖拽区域 */}
            <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-8 md:p-14 text-center transition bg-emerald-50/20">
              {isProcessing ? (
                <div className="py-6 space-y-3">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Validating spreadsheet format...
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
                      onClick={handleStartReview}
                      style={{ backgroundColor: '#047857', color: '#ffffff' }}
                      className="mt-3 px-5 py-2 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span style={{ color: '#ffffff' }}>Choose file</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 文件限制说明 */}
            <div className="flex flex-col sm:flex-row justify-between text-[11px] text-slate-400 gap-1 border-b border-slate-100 pb-4">
              <span>Supported Formats: CSV, XLS, XLSX</span>
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
                    Download the attached example template and share to contractors to use as a
                    starting point for their report files
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => alert('Downloading report template...')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-700" />
                <span>Download</span>
              </button>
            </div>

            {/* Contractor 下拉选择 */}
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
                <option value="Contractor 1">Contractor 1</option>
                <option value="GreenSort Textiles">GreenSort Textiles</option>
                <option value="ReWeave Recyclers">ReWeave Recyclers</option>
              </select>
            </div>

            {/* 底部按钮条 */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-slate-100 gap-3">
              <button
                type="button"
                onClick={() =>
                  alert('Formatting guide: Ensure 5 statutory outcome columns are included.')
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
                  onClick={handleStartReview}
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
                  File: <span className="font-semibold text-slate-700">{uploadedFileName}</span> (
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
                      Resold
                    </th>
                    <th className="py-3 px-3 text-blue-800 bg-blue-100/60 font-bold">
                      Recycled Fiber
                    </th>
                    <th className="py-3 px-3 text-amber-800 bg-amber-100/60 font-bold">
                      Downcycled
                    </th>
                    <th className="py-3 px-3 text-purple-800 bg-purple-100/60 font-bold">
                      Exported
                    </th>
                    <th className="py-3 px-3 text-rose-800 bg-rose-100/60 font-bold">Landfilled</th>
                    <th className="py-3 px-3">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportRows.map((r) => (
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
                        {r.resoldKg} kg
                      </td>
                      <td className="py-3 px-3 text-blue-800 font-bold bg-blue-50/30">
                        {r.recycledFiberKg} kg
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

            {/* 操作栏 - 彻底修好白色高亮文字 */}
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
                onClick={() => setStep(3)}
                style={{ backgroundColor: '#047857', color: '#ffffff' }}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span style={{ color: '#ffffff' }}>Save Valid Records ({verifiedCount})</span>
                <ArrowRight className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Mock Completion */}
        {step === 3 && (
          <div className="p-8 md:p-12 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Validation Completed</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mock import completed. Verified rows are staged for review and non-compliant records
                have been flagged for contractor follow-up.
              </p>
            </div>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
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
