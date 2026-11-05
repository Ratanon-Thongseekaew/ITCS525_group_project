import { Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { WorkspaceFeaturePage } from './components/WorkspaceFeaturePage'
import { AdminPage } from './pages/AdminPage'
import { DirectResalePage } from './pages/DirectResalePage'
import { LoginPage } from './pages/LoginPage'
import { ManagerPage } from './pages/ManagerPage'
import { NewBinsForHandoffPage } from './pages/NewBinsForHandoffPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StaffPage } from './pages/StaffPage'
import { UserManagementPage } from './pages/UserManagementPage'

function App() {
  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path="login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route path="manager" element={<ManagerPage />} />
        <Route
          path="manager/resale-bins"
          element={
            <WorkspaceFeaturePage
              role="manager"
              title="Resale Bin Records"
              description="View and manage garments prepared for direct resale."
            />
          }
        />
        <Route
          path="manager/recycle-bins"
          element={
            <WorkspaceFeaturePage
              role="manager"
              title="Recycle Bin Records"
              description="Track recycling bins, contractor pickups, and reported outcomes."
            />
          }
        />

        <Route path="staff" element={<StaffPage />} />
        <Route path="direct-resale" element={<DirectResalePage />} />
        <Route
          path="staff/resale-bins"
          element={
            <WorkspaceFeaturePage
              role="staff"
              title="Resale Bin Records"
              description="View and manage garments prepared for direct resale."
            />
          }
        />
        <Route
          path="staff/recycle-bins"
          element={
            <WorkspaceFeaturePage
              role="staff"
              title="Recycle Bin Records"
              description="Track recycling bins, contractor pickups, and reported outcomes."
            />
          }
        />
        <Route path="staff/recycle-bin-handoff" element={<NewBinsForHandoffPage />} />
        <Route
          path="staff/recycle-bin-handoff/pickup-dates"
          element={
            <WorkspaceFeaturePage
              role="staff"
              title="Scheduled Pickup Dates"
              description="See upcoming contractor pickups for recycling bins."
            />
          }
        />
        <Route
          path="staff/recycle-bin-handoff/records"
          element={
            <WorkspaceFeaturePage
              role="staff"
              title="Handoff Records"
              description="Review contractor collections, recorded weights, and material outcomes."
            />
          }
        />

        <Route path="admin" element={<AdminPage />} />
        <Route path="admin/users" element={<UserManagementPage />} />
        <Route
          path="admin/resale-bins"
          element={
            <WorkspaceFeaturePage
              role="admin"
              title="Resale Bin Records"
              description="View and manage garments prepared for direct resale."
            />
          }
        />
        <Route
          path="admin/recycle-bins"
          element={
            <WorkspaceFeaturePage
              role="admin"
              title="Recycle Bin Records"
              description="Track recycling bins, contractor pickups, and reported outcomes."
            />
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
