import type { schema } from '@realtime-kanban/db';
import type { Board, Member, User, Workspace, WorkspaceRole } from '@realtime-kanban/shared';

type UserRow = typeof schema.users.$inferSelect;
type WorkspaceRow = typeof schema.workspaces.$inferSelect;
type BoardRow = typeof schema.boards.$inferSelect;

export const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatarUrl: row.avatarUrl,
});

export const toWorkspace = (row: WorkspaceRow, role: WorkspaceRole): Workspace => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  ownerId: row.ownerId,
  createdAt: row.createdAt.toISOString(),
  role,
});

export const toMember = (
  user: UserRow,
  membership: { role: WorkspaceRole; joinedAt: Date },
): Member => ({
  userId: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  role: membership.role,
  joinedAt: membership.joinedAt.toISOString(),
});

export const toBoard = (row: BoardRow): Board => ({
  id: row.id,
  workspaceId: row.workspaceId,
  title: row.title,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  archivedAt: row.archivedAt?.toISOString() ?? null,
});
