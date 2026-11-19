import { createInitialBoardState, readBoard } from '@realtime-kanban/board-doc';
import { schema, type Database } from '@realtime-kanban/db';
import { eq } from 'drizzle-orm';
import type * as Y from 'yjs';

const DOCUMENT_NAME = /^board:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** Documents are named `board:{uuid}`; returns the board id or `null` for anything else. */
export function parseDocumentName(documentName: string): string | null {
  return DOCUMENT_NAME.exec(documentName)?.[1] ?? null;
}

/**
 * Loads the stored Yjs state of a board. Boards created before documents existed get their
 * initial state (default columns) here; `ON CONFLICT DO NOTHING` makes concurrent first loads on
 * several instances agree on a single initial document.
 */
export async function loadBoardState(db: Database, boardId: string): Promise<Uint8Array | null> {
  const existing = await db.query.boardDocuments.findFirst({
    where: eq(schema.boardDocuments.boardId, boardId),
  });
  if (existing) return existing.state;

  const board = await db.query.boards.findFirst({ where: eq(schema.boards.id, boardId) });
  if (!board) return null;

  await db
    .insert(schema.boardDocuments)
    .values({ boardId, state: createInitialBoardState(board.title) })
    .onConflictDoNothing();
  const created = await db.query.boardDocuments.findFirst({
    where: eq(schema.boardDocuments.boardId, boardId),
  });
  return created?.state ?? null;
}

/** Persists the full state and mirrors the title into `boards` for listing without the doc. */
export async function storeBoardState(
  db: Database,
  boardId: string,
  state: Uint8Array,
  document: Y.Doc,
): Promise<void> {
  const title = readBoard(document).title.trim();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(schema.boardDocuments)
      .values({ boardId, state, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.boardDocuments.boardId,
        set: { state, updatedAt: now },
      });
    await tx
      .update(schema.boards)
      .set({ updatedAt: now, ...(title && { title }) })
      .where(eq(schema.boards.id, boardId));
  });
}
