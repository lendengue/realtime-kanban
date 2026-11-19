import { readBoard } from '@realtime-kanban/board-doc';
import { schema } from '@realtime-kanban/db';
import type { Board } from '@realtime-kanban/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createBoard, workspaceWithAllRoles } from '../../test/fixtures.js';
import { useTestApp, type TestUser } from '../../test/harness.js';

describe('boards', () => {
  const t = useTestApp();

  const request = (
    user: TestUser,
    method: 'GET' | 'POST' | 'PATCH',
    url: string,
    payload?: object,
  ) =>
    t.app.inject({
      method,
      url: `/api/v1${url}`,
      headers: user.headers,
      ...(payload && { payload }),
    });

  const listBoards = async (user: TestUser, workspaceId: string, archived = false) =>
    (await request(user, 'GET', `/workspaces/${workspaceId}/boards?archived=${archived}`)).json<{
      boards: Board[];
    }>().boards;

  it('creates, renames, archives and restores a board', async () => {
    const { workspace, member } = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const board = await createBoard(t.app, member, workspace.id, 'Roadmap');
    expect(board).toMatchObject({ title: 'Roadmap', workspaceId: workspace.id, archivedAt: null });

    const renamed = await request(member, 'PATCH', `/boards/${board.id}`, { title: 'Q1 roadmap' });
    expect(renamed.json()).toMatchObject({ board: { title: 'Q1 roadmap' } });

    const archived = await request(member, 'POST', `/boards/${board.id}/archive`);
    expect(archived.json<{ board: Board }>().board.archivedAt).not.toBeNull();
    expect(await listBoards(member, workspace.id)).toEqual([]);
    expect((await listBoards(member, workspace.id, true)).map((b) => b.id)).toEqual([board.id]);

    const restored = await request(member, 'POST', `/boards/${board.id}/restore`);
    expect(restored.json()).toMatchObject({ board: { archivedAt: null } });
    expect((await listBoards(member, workspace.id)).map((b) => b.title)).toEqual(['Q1 roadmap']);
  });

  it('creates the initial Yjs document with the default columns', async () => {
    const { workspace, member } = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const board = await createBoard(t.app, member, workspace.id, 'Launch');

    const [row] = await t.database.db
      .select()
      .from(schema.boardDocuments)
      .where(eq(schema.boardDocuments.boardId, board.id));
    expect(row).toBeDefined();

    const doc = new Y.Doc();
    Y.applyUpdate(doc, row!.state);
    const view = readBoard(doc);
    expect(view.title).toBe('Launch');
    expect(view.columns.map((column) => column.title)).toEqual(['To do', 'In progress', 'Done']);
  });

  it('lets viewers list boards but not create, rename or archive them', async () => {
    const { workspace, owner, viewer } = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const board = await createBoard(t.app, owner, workspace.id);

    expect(await listBoards(viewer, workspace.id)).toHaveLength(1);
    const attempts = await Promise.all([
      request(viewer, 'POST', `/workspaces/${workspace.id}/boards`, { title: 'Nope' }),
      request(viewer, 'PATCH', `/boards/${board.id}`, { title: 'Nope' }),
      request(viewer, 'POST', `/boards/${board.id}/archive`),
      request(viewer, 'POST', `/boards/${board.id}/restore`),
    ]);
    expect(attempts.map((r) => r.statusCode)).toEqual([403, 403, 403, 403]);
  });

  it('hides boards from non-members', async () => {
    const { workspace, owner, outsider } = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const board = await createBoard(t.app, owner, workspace.id);

    expect((await request(outsider, 'GET', `/workspaces/${workspace.id}/boards`)).statusCode).toBe(
      404,
    );
    const rename = await request(outsider, 'PATCH', `/boards/${board.id}`, { title: 'Hacked' });
    expect(rename.statusCode).toBe(404);
    expect(rename.json()).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Board not found' },
    });
  });

  it('validates titles and ids', async () => {
    const { workspace, owner } = await workspaceWithAllRoles(t.app, t.lastAcceptUrl);
    const empty = await request(owner, 'POST', `/workspaces/${workspace.id}/boards`, {
      title: '  ',
    });
    expect(empty.statusCode).toBe(400);
    expect((await request(owner, 'PATCH', '/boards/not-a-uuid', { title: 'x' })).statusCode).toBe(
      400,
    );
  });
});
