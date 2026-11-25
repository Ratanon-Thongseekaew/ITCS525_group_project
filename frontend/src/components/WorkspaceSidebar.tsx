import { LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import textileTrackLogo from '@/assets/logos/textile-track-app-logo-1024.png'
import {
  getWorkspaceHomeUrl,
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
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-2">
        <Link
          to={getWorkspaceHomeUrl(role)}
          className="flex min-h-10 items-center gap-2.5 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Textile Track dashboard"
        >
          <img
            src={textileTrackLogo}
            alt=""
            className="size-8 shrink-0 object-contain"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            Textile Track
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigationItems.map((item) => {
                const url = getWorkspaceNavigationUrl(role, item.segment)
                const isActive =
                  location.pathname === url || location.pathname.startsWith(`${url}/`)

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-9 gap-3 rounded-md px-3 text-xs font-medium text-sidebar-foreground/80 hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
              className="h-9 gap-3 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/15 hover:text-destructive"
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
