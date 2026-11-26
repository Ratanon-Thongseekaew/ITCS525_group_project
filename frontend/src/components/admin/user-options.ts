import type { Store, UserRole } from '@/api'

export const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Store Staff',
}

export const roleOptions = (['staff', 'manager', 'admin'] as const).map((value) => ({
  value,
  label: roleLabels[value],
}))

export function storeOptions(sites: Store[]) {
  return sites.map((site) => ({ value: String(site.id), label: site.name }))
}
