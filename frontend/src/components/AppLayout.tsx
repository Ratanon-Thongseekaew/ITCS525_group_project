import { Outlet, useLocation } from 'react-router'
import { ApiStatus } from './ApiStatus'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { isWorkspaceRole } from '@/types/workspace'

export function AppLayout() {
  const location = useLocation()
  const pathRole = location.pathname.split('/')[1]
  const role = isWorkspaceRole(pathRole) ? pathRole : 'staff'

  return (
    <SidebarProvider>
      <WorkspaceSidebar role={role} />
      <SidebarInset className="min-w-0 bg-slate-50">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="-ml-1 text-slate-600" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-700 capitalize">
              {role} workspace
            </p>
          </div>
          <ApiStatus />
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
