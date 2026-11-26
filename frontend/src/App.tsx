import { Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { GarmentSortingWorkspace } from './components/GarmentSortingWorkspace'
import { SortingOverviewPage } from './pages/SortingOverviewPage'
import ResaleBinRecords from './components/ResaleBinRecords'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import { useSessionCheck } from './lib/auth-session'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { ComplianceDashboardPage } from './pages/ComplianceDashboardPage'
import { DesignSystemPage } from './pages/DesignSystemPage'
import { DirectResalePage } from './pages/DirectResalePage'
import { EprReportPrintPage } from './pages/EprReportPrintPage'
import { HandoffRecordsPage } from './pages/HandoffRecordsPage'
import { LoginPage } from './pages/LoginPage'
import { ManagerPage } from './pages/ManagerPage'
import { NewBinsForHandoffPage } from './pages/NewBinsForHandoffPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PotentialRevenueAnalysisPage } from './pages/PotentialRevenueAnalysisPage'
import { ProcessedBinsRecordPage } from './pages/ProcessedBinsRecordPage'
import { UserManagementPage } from './pages/UserManagementPage'
import ContractorReportImportPage from './pages/ContractorReportImportPage'

function App() {
  useSessionCheck()

  return (
    <TooltipProvider>
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="design-system" element={<DesignSystemPage />} />
        <Route element={<RequireAuth />}>
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="manager/epr-report/print" element={<EprReportPrintPage />} />
          <Route path="admin/epr-report/print" element={<EprReportPrintPage />} />
          <Route element={<AppLayout />}>
            <Route path="manager" element={<ManagerPage />} />
            <Route path="manager/compliance-dashboard" element={<ComplianceDashboardPage />} />
            <Route path="manager/import" element={<ContractorReportImportPage />} />
            <Route path="manager/sorting" element={<SortingOverviewPage />} />
            <Route path="manager/resale-bins" element={<ResaleBinRecords />} />
            {/* <Route
              path="manager/recycle-bins"
              element={
                <WorkspaceFeaturePlaceholderPage
                  role="manager"
                  title="Recycle Bin Records"
                  description="Track recycling bins, contractor pickups, and reported outcomes."
                />
              }
            /> */}
            <Route path="staff/sorting" element={<GarmentSortingWorkspace />} />
            <Route path="staff/direct-resale" element={<DirectResalePage />} />
            <Route
              path="staff/direct-resale/potential-revenue-analysis"
              element={<PotentialRevenueAnalysisPage />}
            />
            <Route
              path="staff/direct-resale/processed-bins-record"
              element={<ProcessedBinsRecordPage />}
            />
            <Route path="staff/recycle-bin-handoff" element={<NewBinsForHandoffPage />} />
            <Route
              path="staff/recycle-bin-handoff/handoff-records"
              element={<HandoffRecordsPage />}
            />
            <Route path="admin/compliance-dashboard" element={<ComplianceDashboardPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  )
}

export default App
