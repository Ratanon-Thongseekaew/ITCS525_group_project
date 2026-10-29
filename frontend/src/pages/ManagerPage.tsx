import { NavLink, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  ArrowRightLeft,
  Recycle,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
  TrendingUp,
  PackageCheck,
  AlertTriangle,
} from 'lucide-react'

export function ManagerPage() {
  const navigate = useNavigate()

  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)] bg-slate-100 font-sans text-slate-800">
      {/* 统一的 Manager 侧边栏 */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              👕
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">Textile Track</h1>
              <p className="text-[10px] text-slate-400 font-medium">Circularity Platform</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              WORKSPACE
            </p>

            <NavLink
              to="/manager"
              end
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4 text-emerald-600" />
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
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>Import Contractor Report</span>
            </NavLink>
          </nav>
        </div>

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

      {/* 右侧 Compliance Dashboard 页面内容 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>Operations</span>
            <span>/</span>
            <span>Compliance</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Dashboard</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Manager workspace
          </span>
        </header>

        <main className="p-8 flex-1 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Keep the team moving.
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Compliance Dashboard • Overview of circularity validation metrics and contractor
                  audit statuses.
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Overview of circularity validation metrics, store collection tallies, and contractor
                audit statuses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/manager/contractor-reports/import')}
              style={{ backgroundColor: '#047857', color: '#ffffff' }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span style={{ color: '#ffffff' }}>Import Monthly Report</span>
            </button>
          </div>

          {/* 仪表盘 KPI 指标 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Total Ingested</span>
                <PackageCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">1,428 kg</p>
              <span className="text-[11px] text-emerald-600 font-medium">↑ 12% vs last month</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Chain of Custody</span>
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">98.4%</p>
              <span className="text-[11px] text-slate-500 font-medium">
                Compliance threshold: 95%
              </span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Variance Rate</span>
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">±1.8%</p>
              <span className="text-[11px] text-emerald-600 font-medium">
                Within safe tolerance (±5%)
              </span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase">Audit Flags</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-bold text-rose-700 mt-2">3 Discrepancies</p>
              <span className="text-[11px] text-rose-600 font-medium">
                Action required by contractor
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default ManagerPage
