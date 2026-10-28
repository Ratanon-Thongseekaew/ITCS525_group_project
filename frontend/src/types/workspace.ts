export const workspaceRoles = ['manager', 'staff', 'admin'] as const

export type WorkspaceRole = (typeof workspaceRoles)[number]

export function isWorkspaceRole(value: string | undefined): value is WorkspaceRole {
  return workspaceRoles.some((role) => role === value)
}
