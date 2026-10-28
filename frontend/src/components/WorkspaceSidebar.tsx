import { LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import textileTrackLogo from '@/assets/logos/textile-track-app-logo-1024.png'
import {
  getWorkspaceNavigation,
  getWorkspaceNavigationUrl,
  type WorkspaceNavigationItem,
} from '@/config/workspace-navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import type { WorkspaceRole } from '@/types/workspace'

interface WorkspaceSidebarProps {
  role: WorkspaceRole
  items?: readonly WorkspaceNavigationItem[]
}

export function WorkspaceSidebar({ role, items }: WorkspaceSidebarProps) {
  const location = useLocation()
  const navigationItems = items ?? getWorkspaceNavigation(role)

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-slate-200">
      <SidebarHeader className="px-4 py-2">
        <Link
          to={`/${role}`}
          className="flex min-h-10 items-center gap-2.5 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          aria-label="Textile Track dashboard"
        >
          <img
            src={textileTrackLogo}
            alt=""
            className="size-8 shrink-0 object-contain"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold tracking-tight text-slate-900">Textile Track</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigationItems.map((item) => {
                const url = getWorkspaceNavigationUrl(role, item.segment)
                const isActive = location.pathname === url

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-9 gap-3 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-teal-50 hover:text-teal-700 data-[active=true]:bg-teal-50 data-[active=true]:text-teal-700"
                    >
                      <Link to={url}>
                        <item.icon strokeWidth={1.8} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Sign out"
              className="h-9 gap-3 bg-red-50 px-3 text-xs font-medium text-red-500 hover:bg-red-100 hover:text-red-600"
            >
              <Link to="/login">
                <LogOut strokeWidth={1.8} />
                <span>Sign Out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
