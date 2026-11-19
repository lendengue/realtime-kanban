import { schema, type Database } from '@realtime-kanban/db';
import { can, type Permission, type WorkspaceRole } from '@realtime-kanban/shared';
import { and, eq } from 'drizzle-orm';

import { forbidden, notFound } from '../../lib/errors.js';

type WorkspaceRow = typeof schema.workspaces.$inferSelect;

export interface WorkspaceAccess {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}

/**
 * Loads a workspace the user belongs to and checks a permission.
 * Non-members get 404 (existence is not disclosed); members without the permission get 403.
 */
export async function requireWorkspacePermission(
  db: Database,
  workspaceId: string,
  userId: string,
  permission: Permission,
): Promise<WorkspaceAccess> {
  const [row] = await db
    .select({ workspace: schema.workspaces, role: schema.workspaceMembers.role })
    .from(schema.workspaces)
    .innerJoin(
      schema.workspaceMembers,
      and(
        eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);

  if (!row) throw notFound('Workspace');
  if (!can(row.role, permission)) throw forbidden();
  return row;
}
