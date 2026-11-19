import * as Y from 'yjs';

import { initializeBoard } from '../operations.js';
import { readBoard, type BoardView } from '../read.js';

/** Creates `count` replicas that all start from the same initialised board. */
export function createReplicas(count: number, title = 'Board'): Y.Doc[] {
  const origin = new Y.Doc();
  initializeBoard(origin, { title });
  const state = Y.encodeStateAsUpdate(origin);
  return Array.from({ length: count }, () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);
    return doc;
  });
}

/** Sends to `to` everything `from` has that `to` is missing. */
export function syncOneWay(from: Y.Doc, to: Y.Doc): void {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)));
}

/** Full mesh sync until every replica has every update. */
export function syncAll(docs: readonly Y.Doc[]): void {
  for (const from of docs) for (const to of docs) if (from !== to) syncOneWay(from, to);
}

/** Records every update a doc produces, to replay them later in arbitrary orders. */
export function recordUpdates(doc: Y.Doc): Uint8Array[] {
  const updates: Uint8Array[] = [];
  doc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
}

export function columnIds(doc: Y.Doc): string[] {
  return readBoard(doc).columns.map((column) => column.id);
}

/** Every card id visible in the view (active cards in columns + archived). */
export function allCardIds(view: BoardView): string[] {
  return [
    ...view.columns.flatMap((column) => column.cards.map((card) => card.id)),
    ...view.archivedCards.map((card) => card.id),
  ];
}
