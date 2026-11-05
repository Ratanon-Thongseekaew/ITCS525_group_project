import {
  ArrowDownUp,
  ChartNoAxesCombined,
  Recycle,
  Shirt,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import type { WorkspaceRole } from '@/types/workspace'

export interface WorkspaceNavigationItem {
  label: string
  segment: string
  // Absolute path for destinations outside `/:role/`. Takes precedence over `segment`.
  href?: string
  icon: LucideIcon
  roles?: readonly WorkspaceRole[]
}

export const workspaceNavigation: readonly WorkspaceNavigationItem[] = [
  {
    label: 'Compliance Dashboard',
    segment: 'compliance-dashboard',
    icon: ChartNoAxesCombined,
    roles: ['manager', 'admin'],
  },
  {
    label: 'Resale Bin Records',
    segment: 'resale-bins',
    icon: Shirt,
    roles: ['manager', 'admin'],
  },
  {
    label: 'Recycle Bin Records',
    segment: 'recycle-bins',
    icon: Recycle,
    roles: ['manager', 'admin'],
  },
  {
    label: 'User Management',
    segment: 'users',
    icon: UserPlus,
    roles: ['admin'],
  },
  {
    label: 'Sorting',
    segment: '',
    icon: ArrowDownUp,
    roles: ['staff'],
  },
  {
    label: 'Direct Resale',
    segment: 'direct-resale',
    href: '/direct-resale',
    icon: Shirt,
    roles: ['staff'],
  },
  {
    label: 'Recycle Bin Handoff',
    segment: 'recycle-bin-handoff',
    icon: Recycle,
    roles: ['staff'],
  },
]

export function getWorkspaceNavigation(role: WorkspaceRole) {
  return workspaceNavigation.filter((item) => !item.roles || item.roles.includes(role))
}

export function getWorkspaceNavigationUrl(role: WorkspaceRole, segment: string) {
  return segment ? `/${role}/${segment}` : `/${role}`
}
