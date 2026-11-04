import { ChartNoAxesCombined, Recycle, Shirt, UserPlus, type LucideIcon } from 'lucide-react'
import type { WorkspaceRole } from '@/types/workspace'

export interface WorkspaceNavigationItem {
  label: string
  segment: string
  icon: LucideIcon
  roles?: readonly WorkspaceRole[]
}

export const workspaceNavigation: readonly WorkspaceNavigationItem[] = [
  {
    label: 'Compliance Dashboard',
    segment: 'compliance-dashboard',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Resale Bin Records',
    segment: 'resale-bins',
    icon: Shirt,
  },
  {
    label: 'Recycle Bin Records',
    segment: 'recycle-bins',
    icon: Recycle,
  },
  {
    label: 'User Management',
    segment: 'users',
    icon: UserPlus,
    roles: ['admin'],
  },
]

export function getWorkspaceNavigation(role: WorkspaceRole) {
  return workspaceNavigation.filter((item) => !item.roles || item.roles.includes(role))
}

export function getWorkspaceNavigationUrl(role: WorkspaceRole, segment: string) {
  return segment ? `/${role}/${segment}` : `/${role}`
}
