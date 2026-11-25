import { Outlet, useLocation } from 'react-router'
import { ApiStatus } from './ApiStatus'
import { ModeToggle } from './ModeToggle'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { isWorkspaceRole } from '@/types/workspace'

export function AppLayout() {
  const { pathname } = useLocation()
  const pathRole = pathname.split('/')[1]
  const role = isWorkspaceRole(pathRole) ? pathRole : 'staff'

  return (
    <SidebarProvider>
      <WorkspaceSidebar role={role} />

      <SidebarInset className="min-w-0 bg-muted/40">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground capitalize">
              {role} workspace
            </p>
          </div>

          <ApiStatus />
          <ModeToggle />
        </header>

        <main className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:py-16 lg:py-24">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
