import { ChartNoAxesCombined, Recycle, Shirt, type LucideIcon } from 'lucide-react'
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
    segment: '',
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
]

export function getWorkspaceNavigation(role: WorkspaceRole) {
  return workspaceNavigation.filter((item) => !item.roles || item.roles.includes(role))
}

export function getWorkspaceNavigationUrl(role: WorkspaceRole, segment: string) {
  return segment ? `/${role}/${segment}` : `/${role}`
}
