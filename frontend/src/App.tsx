import { Route, Routes } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { ManagerPage } from './pages/ManagerPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StaffPage } from './pages/StaffPage'
import ContractorReportImportPage from './pages/ContractorReportImportPage'

export function App() {
  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="manager" element={<ManagerPage />} />
        <Route path="manager/contractor-reports/import" element={<ContractorReportImportPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
