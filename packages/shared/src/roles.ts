/** Workspace roles, from most to least privileged. */
export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Roles that can be granted through invitations or role changes (ownership is not transferable). */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type Permission =
  | 'workspace:view'
  | 'workspace:rename'
  | 'workspace:delete'
  | 'members:manage'
  | 'boards:manage'
  | 'boards:edit';

const PERMISSIONS: Record<WorkspaceRole, ReadonlySet<Permission>> = {
  owner: new Set([
    'workspace:view',
    'workspace:rename',
    'workspace:delete',
    'members:manage',
    'boards:manage',
    'boards:edit',
  ]),
  admin: new Set([
    'workspace:view',
    'workspace:rename',
    'members:manage',
    'boards:manage',
    'boards:edit',
  ]),
  member: new Set(['workspace:view', 'boards:manage', 'boards:edit']),
  viewer: new Set(['workspace:view']),
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return PERMISSIONS[role].has(permission);
}
