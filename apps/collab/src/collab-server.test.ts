import { createCard, readBoard, setBoardTitle } from '@realtime-kanban/board-doc';
import { schema } from '@realtime-kanban/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { seedBoard, useCollabServer } from './test/harness.js';

const firstColumnId = (doc: Y.Doc) => {
  const id = readBoard(doc).columns[0]?.id;
  if (!id) throw new Error('board has no columns');
  return id;
};

const cardTitles = (doc: Y.Doc) =>
  readBoard(doc).columns.flatMap((column) => column.cards.map((card) => card.title));

describe('collab server', () => {
  const t = useCollabServer();

  it('answers GET /health', async () => {
    const response = await fetch(t.url.replace('ws://', 'http://') + '/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'collab' });
  });

  it('syncs edits between two clients in real time', async () => {
    const { boardId, users, tokens } = await seedBoard(t, ['owner', 'member']);
    const alice = t.connect({ boardId, token: tokens[0]! });
    const bob = t.connect({ boardId, token: tokens[1]! });
    await Promise.all([alice.synced, bob.synced]);

    // Both received the lazily created initial document (default columns).
    expect(readBoard(alice.doc).columns.map((c) => c.title)).toEqual([
      'To do',
      'In progress',
      'Done',
    ]);
    expect(readBoard(bob.doc)).toEqual(readBoard(alice.doc));

    createCard(alice.doc, {
      columnId: firstColumnId(alice.doc),
      title: 'From Alice',
      createdBy: users[0]!.id,
    });
    await vi.waitFor(() => expect(cardTitles(bob.doc)).toEqual(['From Alice']));

    createCard(bob.doc, {
      columnId: firstColumnId(bob.doc),
      title: 'From Bob',
      createdBy: users[1]!.id,
    });
    await vi.waitFor(() => expect(cardTitles(alice.doc)).toEqual(['From Alice', 'From Bob']));
  });

  it('persists the document and mirrors the board title in Postgres', async () => {
    const { boardId, users, tokens } = await seedBoard(t, ['owner']);
    const alice = t.connect({ boardId, token: tokens[0]! });
    await alice.synced;

    setBoardTitle(alice.doc, 'Renamed board');
    createCard(alice.doc, {
      columnId: firstColumnId(alice.doc),
      title: 'Persisted',
      createdBy: users[0]!.id,
    });

    await vi.waitFor(
      async () => {
        const [board] = await t.database.db
          .select()
          .from(schema.boards)
          .where(eq(schema.boards.id, boardId));
        expect(board?.title).toBe('Renamed board');

        const [row] = await t.database.db
          .select()
          .from(schema.boardDocuments)
          .where(eq(schema.boardDocuments.boardId, boardId));
        const stored = new Y.Doc();
        Y.applyUpdate(stored, row!.state);
        expect(cardTitles(stored)).toEqual(['Persisted']);
      },
      { timeout: 5000, interval: 100 },
    );
  });

  it('serves the persisted state to clients that connect later', async () => {
    const { boardId, users, tokens } = await seedBoard(t, ['owner']);
    const first = t.connect({ boardId, token: tokens[0]! });
    await first.synced;
    createCard(first.doc, {
      columnId: firstColumnId(first.doc),
      title: 'Kept',
      createdBy: users[0]!.id,
    });
    first.provider.destroy();

    // Once the last client leaves, the document is stored and unloaded from memory...
    await vi.waitFor(() => expect(t.server.hocuspocus.getDocumentsCount()).toBe(0), {
      timeout: 5000,
    });
    // ...so the next client gets it from Postgres.
    const later = t.connect({ boardId, token: tokens[0]! });
    await later.synced;
    expect(cardTitles(later.doc)).toEqual(['Kept']);
  });

  describe('authentication', () => {
    it('rejects an invalid token', async () => {
      const { boardId } = await seedBoard(t, ['owner']);
      const client = t.connect({ boardId, token: 'not-a-jwt' });
      expect(await client.authFailure).toBeTruthy();
      expect(client.provider.isAuthenticated).toBe(false);
    });

    it('rejects users who are not members of the workspace', async () => {
      const { boardId } = await seedBoard(t, ['owner']);
      const other = await seedBoard(t, ['owner']);
      const client = t.connect({ boardId, token: other.tokens[0]! });
      expect(await client.authFailure).toBeTruthy();
    });

    it('rejects malformed document names', async () => {
      const { boardId, tokens } = await seedBoard(t, ['owner']);
      const client = t.connect({ boardId, token: tokens[0]!, documentName: 'something-else' });
      expect(await client.authFailure).toBeTruthy();
    });
  });

  describe('read-only access', () => {
    it('connects viewers read-only and drops their edits', async () => {
      const { boardId, users, tokens } = await seedBoard(t, ['owner', 'viewer']);
      const owner = t.connect({ boardId, token: tokens[0]! });
      const viewer = t.connect({ boardId, token: tokens[1]! });
      await Promise.all([owner.synced, viewer.synced]);
      expect(viewer.provider.authorizedScope).toBe('readonly');
      expect(owner.provider.authorizedScope).toBe('read-write');

      // The viewer edits its local copy; the server must not accept it.
      createCard(viewer.doc, {
        columnId: firstColumnId(viewer.doc),
        title: 'Sneaky',
        createdBy: users[1]!.id,
      });
      // A later owner edit proves the channel works and the viewer edit was dropped.
      createCard(owner.doc, {
        columnId: firstColumnId(owner.doc),
        title: 'Legit',
        createdBy: users[0]!.id,
      });

      await vi.waitFor(() => expect(cardTitles(viewer.doc)).toContain('Legit'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(cardTitles(owner.doc)).toEqual(['Legit']);
    });

    it('makes archived boards read-only for every role', async () => {
      const { boardId, tokens } = await seedBoard(t, ['owner'], { archived: true });
      const owner = t.connect({ boardId, token: tokens[0]! });
      await owner.synced;
      expect(owner.provider.authorizedScope).toBe('readonly');
    });
  });
});
