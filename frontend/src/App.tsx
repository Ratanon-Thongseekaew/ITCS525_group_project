import { Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { GarmentSortingWorkspace } from './components/GarmentSortingWorkspace'
import { WorkspaceFeaturePlaceholderPage } from './components/WorkspaceFeaturePlaceholderPage'
import { Toaster } from './components/ui/sonner'
import { ComplianceDashboardPage } from './pages/ComplianceDashboardPage'
import { DirectResalePage } from './pages/DirectResalePage'
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
  return (
    <>
      <Routes>
        <Route index element={<LoginPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route
            path="manager/contractor-reports/import"
            element={<ContractorReportImportPage />}
          />
          <Route path="manager" element={<ManagerPage />} />
          <Route path="manager/compliance-dashboard" element={<ComplianceDashboardPage />} />
          <Route
            path="manager/resale-bins"
            element={
              <WorkspaceFeaturePlaceholderPage
                role="manager"
                title="Resale Bin Records"
                description="View and manage garments prepared for direct resale."
              />
            }
          />
          <Route
            path="manager/recycle-bins"
            element={
              <WorkspaceFeaturePlaceholderPage
                role="manager"
                title="Recycle Bin Records"
                description="Track recycling bins, contractor pickups, and reported outcomes."
              />
            }
          />
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
            path="staff/recycle-bin-handoff/scheduled-pickup-dates"
            element={
              <WorkspaceFeaturePlaceholderPage
                role="staff"
                title="Scheduled Pickup Dates"
                description="See upcoming contractor pickups for recycling bins."
              />
            }
          />
          <Route
            path="staff/recycle-bin-handoff/handoff-records"
            element={<HandoffRecordsPage />}
          />
          <Route path="admin/compliance-dashboard" element={<ComplianceDashboardPage />} />
          <Route path="admin/users" element={<UserManagementPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App
