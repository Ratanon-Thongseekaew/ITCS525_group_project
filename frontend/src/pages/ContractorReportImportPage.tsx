import { NavLink, useNavigate } from 'react-router'
import {
  ArrowLeft,
  LayoutDashboard,
  ArrowRightLeft,
  Recycle,
  FileSpreadsheet,
  LogOut,
} from 'lucide-react'
import ContractorReportImport from '../components/ContractorReportImport'

export default function ContractorReportImportPage() {
  const navigate = useNavigate()

  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)] bg-slate-100 font-sans text-slate-800">
      {/* 1. 左侧侧边栏 (解决侧边栏缺失问题) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo 区域 */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              👕
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Textile Track</h1>
              <p className="text-[10px] text-slate-400 font-medium">Circularity Platform</p>
            </div>
          </div>

          {/* 导航项列表 */}
          <nav className="p-4 space-y-1.5">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              WORKSPACE
            </p>

            <NavLink
              to="/manager"
              end
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              <span>Compliance Dashboard</span>
            </NavLink>

            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 cursor-not-allowed">
              <ArrowRightLeft className="w-4 h-4 text-slate-400" />
              <span>Resale Bin Records</span>
            </div>

            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 cursor-not-allowed">
              <Recycle className="w-4 h-4 text-slate-400" />
              <span>Recycle Bin Records</span>
            </div>

            {/* Pure 要求的 Import Data 侧边栏入口 */}
            <NavLink
              to="/manager/contractor-reports/import"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Import Contractor Report</span>
            </NavLink>
          </nav>
        </div>

        {/* 底部登出 */}
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. 右侧全宽主体区 (消除大白边，加入面包屑和标题) */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* 顶部状态与面包屑栏 */}
        <header className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Operations</span>
            <span>/</span>
            <span>Compliance</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Import</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Manager workspace
          </span>
        </header>

        {/* 页面内容区域 */}
        <main className="p-8 flex-1 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Import Monthly Outcome Report File
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Upload and validate monthly outcome report file from contractor
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/manager')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

          {/* 挂载表单组件 */}
          <ContractorReportImport />
        </main>
      </div>
    </div>
  )
}
