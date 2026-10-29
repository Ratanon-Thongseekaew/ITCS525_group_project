import React, { useState } from 'react';

interface SorterReportRow {
  row: number;
  binId: string;
  contractor: string;
  retailerWt: number;
  reportedWt: number;
  resoldKg: number;
  recycledKg: number;
  downcycledKg: number;
  exportedKg: number;
  landfilledKg: number;
  status: 'Verified' | 'Warning' | 'Error';
  errorDetail?: string;
}

export default function ContractorReportImport() {
  const [step, setStep] = useState<number>(1);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // 严格对齐 ISO/IEC 29110 及课程要求的 5 类法定去向数据
  const mockRows: SorterReportRow[] = [
    {
      row: 1,
      binId: 'BIN-C-0047',
      contractor: 'GreenSort Textiles',
      retailerWt: 12.3,
      reportedWt: 12.1,
      resoldKg: 4.2,
      recycledKg: 4.8,
      downcycledKg: 1.8,
      exportedKg: 0.9,
      landfilledKg: 0.4,
      status: 'Verified'
    },
    {
      row: 2,
      binId: 'BIN-C-0046',
      contractor: 'ReWeave Recyclers',
      retailerWt: 15.1,
      reportedWt: 10.0,
      resoldKg: 5.3,
      recycledKg: 2.7,
      downcycledKg: 1.0,
      exportedKg: 0.6,
      landfilledKg: 0.4,
      status: 'Error',
      errorDetail: 'Weight variance exceeds ±5% threshold (-5.1kg discrepancy)'
    },
    {
      row: 3,
      binId: 'MISSING_ID',
      contractor: 'Loopfibre Co.',
      retailerWt: 14.0,
      reportedWt: 13.9,
      resoldKg: 3.5,
      recycledKg: 4.5,
      downcycledKg: 3.0,
      exportedKg: 2.0,
      landfilledKg: 0.9,
      status: 'Error',
      errorDetail: 'Missing or Invalid Bin ID format'
    },
    {
      row: 4,
      binId: 'BIN-C-0042',
      contractor: 'ReWeave Recyclers',
      retailerWt: 16.5,
      reportedWt: 15.8,
      resoldKg: 4.5,
      recycledKg: 4.0,
      downcycledKg: 3.2,
      exportedKg: 2.5,
      landfilledKg: 1.6,
      status: 'Warning',
      errorDetail: 'Minor weight variance flagged (-0.7kg)'
    }
  ];

  const handleSimulateUpload = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setStep(2);
    }, 600);
  };

  const totalRows = mockRows.length;
  const validCount = mockRows.filter(r => r.status === 'Verified').length;
  const errorCount = mockRows.filter(r => r.status === 'Error').length;
  const warningCount = mockRows.filter(r => r.status === 'Warning').length;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-7 bg-slate-50/60 min-h-[720px] rounded-3xl border border-slate-200/90 shadow-sm font-sans text-slate-800">
      
      {/* 顶部 Header 卡片 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-7 rounded-2xl border border-slate-200/80 shadow-sm gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase tracking-wider">
              Feature 5 Module
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-semibold text-slate-500">ISO/IEC 29110 Compliance</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Contractor Monthly Report Import & Verification
          </h2>
          <p className="text-xs md:text-sm text-slate-500 max-w-2xl">
            Automated intake validation pipeline. Audits contractor monthly records across the 5 statutory disposition categories and isolates data discrepancies.
          </p>
        </div>
        <button 
          onClick={() => alert("Downloading Standard Contractor CSV/XLSX Template...")}
          style={{ color: '#0f172a' }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl border border-slate-300/80 shadow-sm transition-all"
        >
          <span>📥</span>
          <span>Download Template</span>
        </button>
      </div>

      {/* 步骤向导 (Steppers) */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { num: 1, title: 'Step 1: Upload File', desc: 'CSV or Excel (.xlsx)' },
          { num: 2, title: 'Step 2: Review 5 Categories', desc: 'Verify weights & rules' },
          { num: 3, title: 'Step 3: Save to Database', desc: 'Isolate & commit' }
        ].map((s) => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              className={`p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 ${
                isActive
                  ? 'bg-emerald-700 border-emerald-700 shadow-md shadow-emerald-700/20'
                  : isDone
                  ? 'bg-emerald-50/80 border-emerald-300'
                  : 'bg-white border-slate-200/90'
              }`}
            >
              <div
                style={{ color: isActive ? '#047857' : isDone ? '#ffffff' : '#94a3b8' }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  isActive
                    ? 'bg-white shadow-sm'
                    : isDone
                    ? 'bg-emerald-600'
                    : 'bg-slate-100'
                }`}
              >
                {isDone ? '✓' : s.num}
              </div>
              <div>
                <p 
                  style={{ color: isActive ? '#ffffff' : isDone ? '#064e3b' : '#334155' }}
                  className="text-xs md:text-sm font-bold tracking-tight"
                >
                  {s.title}
                </p>
                <p 
                  style={{ color: isActive ? '#a7f3d0' : isDone ? '#059669' : '#94a3b8' }}
                  className="text-[11px] font-medium"
                >
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 主面板 */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-sm">
        
        {/* Step 1: 上传区 */}
        {step === 1 && (
          <div className="border-2 border-dashed border-emerald-200/90 hover:border-emerald-500 transition-colors rounded-2xl p-16 text-center space-y-5 bg-emerald-50/20">
            {isAnalyzing ? (
              <div className="py-8 space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="space-y-1">
                  <p className="text-base font-bold text-slate-800">Auditing Sorter Spreadsheet...</p>
                  <p className="text-xs text-slate-500">Checking weight variance (±5%) and validating all 5 disposition categories...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 bg-emerald-100/70 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-inner border border-emerald-200/60">
                  📊
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">
                    Upload Monthly Recycler Outcome Spreadsheet
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Drag and drop contractor CSV/XLSX files here or click below to trigger simulated validation against retail intake logs.
                  </p>
                </div>
                <div className="pt-3">
                  {/* 核心修复：内联纯白色字与深墨绿色底 */}
                  <button
                    onClick={handleSimulateUpload}
                    style={{ color: '#ffffff', backgroundColor: '#047857' }}
                    className="px-7 py-3.5 hover:opacity-95 active:scale-95 text-sm font-bold rounded-xl shadow-lg shadow-emerald-700/25 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    <span>🚀</span>
                    <span>Simulate File Upload & Validation</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 2: 5 类去向明细与高亮 */}
        {step === 2 && (
          <div className="space-y-6">
            {/* KPI 统计条 */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Bins Processed</span>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalRows}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Verified Records</span>
                <p className="text-2xl font-black text-emerald-800 mt-1">{validCount}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Flagged Warnings</span>
                <p className="text-2xl font-black text-amber-800 mt-1">{warningCount}</p>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200/80">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected Discrepancies</span>
                <p className="text-2xl font-black text-rose-800 mt-1">{errorCount}</p>
              </div>
            </div>

            {/* 5-Tier 详细分类表格 */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-3">Row</th>
                    <th className="py-3.5 px-3">Bin ID</th>
                    <th className="py-3.5 px-3">Contractor</th>
                    <th className="py-3.5 px-3">Store Wt</th>
                    <th className="py-3.5 px-3">Reported Wt</th>
                    <th className="py-3.5 px-3 text-emerald-800 bg-emerald-100/40">Resold</th>
                    <th className="py-3.5 px-3 text-blue-800 bg-blue-100/40">Recycled Fiber</th>
                    <th className="py-3.5 px-3 text-amber-800 bg-amber-100/40">Downcycled</th>
                    <th className="py-3.5 px-3 text-purple-800 bg-purple-100/40">Exported</th>
                    <th className="py-3.5 px-3 text-rose-800 bg-rose-100/40">Landfilled</th>
                    <th className="py-3.5 px-3.5">Validation Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockRows.map((r) => (
                    <tr 
                      key={r.row} 
                      className={`transition-colors ${
                        r.status === 'Error' ? 'bg-rose-50/60 hover:bg-rose-50/80' : r.status === 'Warning' ? 'bg-amber-50/50 hover:bg-amber-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-slate-400 font-bold">{r.row}</td>
                      <td className={`py-3.5 px-3 font-mono font-bold ${r.binId === 'MISSING_ID' ? 'text-rose-600 underline' : 'text-slate-900'}`}>
                        {r.binId}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">{r.contractor}</td>
                      <td className="py-3.5 px-3 text-slate-600">{r.retailerWt} kg</td>
                      <td className="py-3.5 px-3 text-slate-900 font-black">{r.reportedWt} kg</td>
                      
                      {/* 5 类去向数据 */}
                      <td className="py-3.5 px-3 text-emerald-700 font-semibold">{r.resoldKg} kg</td>
                      <td className="py-3.5 px-3 text-blue-700 font-semibold">{r.recycledKg} kg</td>
                      <td className="py-3.5 px-3 text-amber-700 font-semibold">{r.downcycledKg} kg</td>
                      <td className="py-3.5 px-3 text-purple-700 font-semibold">{r.exportedKg} kg</td>
                      <td className="py-3.5 px-3 text-rose-700 font-semibold">{r.landfilledKg} kg</td>
                      
                      {/* 状态徽章 */}
                      <td className="py-3.5 px-3.5">
                        {r.status === 'Verified' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Verified
                          </span>
                        )}
                        {r.status === 'Warning' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              ⚠ Flagged
                            </span>
                            <p className="text-[10px] text-amber-700 font-medium">{r.errorDetail}</p>
                          </div>
                        )}
                        {r.status === 'Error' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              ✕ Rejected
                            </span>
                            <p className="text-[10px] text-rose-600 font-bold">{r.errorDetail}</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 操作控制栏 */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setStep(1)}
                style={{ color: '#475569' }}
                className="text-xs font-bold hover:underline transition cursor-pointer"
              >
                ← Back to File Upload
              </button>
              
              {/* 核心修复：纯白字底按钮 */}
              <button
                onClick={() => setStep(3)}
                style={{ color: '#ffffff', backgroundColor: '#047857' }}
                className="px-6 py-3 hover:opacity-95 active:scale-95 text-xs font-bold rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Commit Valid Records ({validCount}) to Database</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 完成入库页 */}
        {step === 3 && (
          <div className="p-12 text-center space-y-6 max-w-lg mx-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-3xl flex items-center justify-center mx-auto text-3xl font-black shadow-inner border border-emerald-200">
              ✓
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                Batch Ingestion Completed!
              </h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Verified records have been committed to the database. Rejected rows ({errorCount}) have been quarantined to prevent misleading environmental compliance disclosures.
              </p>
            </div>
            <div className="pt-2">
              {/* 核心修复：显眼的高级深色按钮，内联纯白文字 */}
              <button
                onClick={() => setStep(1)}
                style={{ color: '#ffffff', backgroundColor: '#0f172a' }}
                className="px-6 py-3 hover:bg-slate-800 active:scale-95 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                🔄 Import Another Monthly Report
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}