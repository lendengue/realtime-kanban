import * as Y from 'yjs';

import { getCards, getColumns, getLabels, getMeta } from './schema.js';

/**
 * Undo manager for the board structure (title, columns, cards, labels) that only tracks
 * transactions made with `origin`, so undo/redo never touches changes that came from other
 * users, from the server or from the offline cache.
 *
 * Every tracked transaction is its own undo step (`captureTimeout: 0`): board operations are
 * discrete actions, and merging two quick moves into one step would surprise the user. Rich text
 * descriptions have their own, editor-scoped undo history (ADR 0020).
 */
export function createBoardUndoManager(doc: Y.Doc, origin: unknown): Y.UndoManager {
  return new Y.UndoManager([getMeta(doc), getColumns(doc), getCards(doc), getLabels(doc)], {
    trackedOrigins: new Set([origin]),
    captureTimeout: 0,
  });
}
