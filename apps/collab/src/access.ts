import { schema, type Database } from '@realtime-kanban/db';
import { can, type WorkspaceRole } from '@realtime-kanban/shared';
import { and, eq } from 'drizzle-orm';

export interface BoardAccess {
  role: WorkspaceRole;
  /** Viewers, and everyone on archived boards, connect read-only. */
  readOnly: boolean;
}

/** Role of `userId` in the workspace that owns `boardId`, or `null` when they have no access. */
export async function getBoardAccess(
  db: Database,
  boardId: string,
  userId: string,
): Promise<BoardAccess | null> {
  const [row] = await db
    .select({ role: schema.workspaceMembers.role, archivedAt: schema.boards.archivedAt })
    .from(schema.boards)
    .innerJoin(
      schema.workspaceMembers,
      and(
        eq(schema.workspaceMembers.workspaceId, schema.boards.workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    )
    .where(eq(schema.boards.id, boardId))
    .limit(1);
  if (!row) return null;
  return { role: row.role, readOnly: !can(row.role, 'boards:edit') || row.archivedAt !== null };
}
