import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  archiveCard,
  createCard,
  createColumn,
  deleteColumn,
  moveCard,
  moveColumn,
  renameColumn,
  restoreCard,
  toggleCardLabel,
  updateCard,
} from './operations.js';
import { readBoard } from './read.js';
import { allCardIds, columnIds, createReplicas, recordUpdates, syncAll } from './test/helpers.js';

/** Asserts that every replica shows the same board and that each card appears exactly once. */
function expectConverged(docs: readonly Y.Doc[], expectedCardIds: readonly string[]) {
  const views = docs.map(readBoard);
  for (const view of views.slice(1)) expect(view).toEqual(views[0]);

  const ids = allCardIds(views[0]!);
  expect(new Set(ids).size).toBe(ids.length); // no duplicates
  expect([...ids].sort()).toEqual([...expectedCardIds].sort()); // nothing lost
  return views[0]!;
}

describe('convergence of concurrent edits', () => {
  it('the same card moved to different columns ends up in exactly one of them', () => {
    const [a, b, c] = createReplicas(3) as [Y.Doc, Y.Doc, Y.Doc];
    const [todo, doing, done] = columnIds(a) as [string, string, string];
    const card = createCard(a, { columnId: todo, title: 'Contested', createdBy: 'alice' });
    syncAll([a, b, c]);

    moveCard(a, card, doing);
    moveCard(b, card, done);
    moveCard(c, card, todo, undefined, undefined);
    syncAll([c, b, a]);

    const view = expectConverged([a, b, c], [card]);
    const holders = view.columns.filter((column) => column.cards.some((x) => x.id === card));
    expect(holders).toHaveLength(1);
  });

  it('concurrent title edits converge to a single winner', () => {
    const [a, b] = createReplicas(2) as [Y.Doc, Y.Doc];
    const [todo] = columnIds(a) as [string];
    const card = createCard(a, { columnId: todo, title: 'Original', createdBy: 'alice' });
    syncAll([a, b]);

    updateCard(a, card, { title: 'Alice title' });
    updateCard(b, card, { title: 'Bob title' });
    syncAll([a, b]);

    const view = expectConverged([a, b], [card]);
    expect(['Alice title', 'Bob title']).toContain(view.columns[0]?.cards[0]?.title);
  });

  it('archiving while someone else edits keeps both changes', () => {
    const [a, b] = createReplicas(2) as [Y.Doc, Y.Doc];
    const [todo] = columnIds(a) as [string];
    const card = createCard(a, { columnId: todo, title: 'Draft', createdBy: 'alice' });
    syncAll([a, b]);

    archiveCard(a, card);
    updateCard(b, card, { title: 'Edited while archived' });
    syncAll([a, b]);

    const view = expectConverged([a, b], [card]);
    expect(view.archivedCards).toMatchObject([{ id: card, title: 'Edited while archived' }]);
  });

  it('cards stay reachable even if every column is archived concurrently', () => {
    const [a, b] = createReplicas(2) as [Y.Doc, Y.Doc];
    const [todo, doing, done] = columnIds(a) as [string, string, string];
    deleteColumn(a, doing);
    deleteColumn(a, done);
    deleteColumn(b, todo);
    const card = createCard(a, { columnId: todo, title: 'Homeless', createdBy: 'alice' });
    syncAll([a, b]);

    const view = expectConverged([a, b], [card]);
    expect(view.columns).toEqual([]);
    expect(view.archivedCards.map((x) => x.id)).toEqual([card]);
  });

  it('a card created in a column that is concurrently deleted stays reachable', () => {
    const [a, b] = createReplicas(2) as [Y.Doc, Y.Doc];
    const [todo, doing] = columnIds(a) as [string, string];
    deleteColumn(a, doing);
    const card = createCard(b, { columnId: doing, title: 'Late', createdBy: 'bob' });
    syncAll([a, b]);

    const view = expectConverged([a, b], [card]);
    // Re-homed into the first active column instead of disappearing.
    expect(view.columns[0]?.id).toBe(todo);
    expect(view.columns[0]?.cards.map((x) => x.id)).toEqual([card]);
  });

  it('two cards inserted into the same slot get a deterministic order', () => {
    const [a, b] = createReplicas(2) as [Y.Doc, Y.Doc];
    const [todo] = columnIds(a) as [string];
    const first = createCard(a, { columnId: todo, title: 'First', createdBy: 'alice' });
    const last = createCard(a, { columnId: todo, title: 'Last', createdBy: 'alice' });
    syncAll([a, b]);

    const x = createCard(a, { columnId: todo, title: 'X', createdBy: 'alice', beforeId: first });
    const y = createCard(b, { columnId: todo, title: 'Y', createdBy: 'bob', beforeId: first });
    syncAll([a, b]);

    const view = expectConverged([a, b], [first, last, x, y]);
    const order = view.columns[0]?.cards.map((card) => card.title);
    expect(order?.[0]).toBe('First');
    expect(order?.[3]).toBe('Last');
    expect(order?.slice(1, 3).sort()).toEqual(['X', 'Y']);
  });

  it('converges regardless of the order updates are delivered in', () => {
    // Five replicas of the same board: three editors and two passive receivers.
    const all = createReplicas(5) as [Y.Doc, Y.Doc, Y.Doc, Y.Doc, Y.Doc];
    const [a, b, c, forward, reverse] = all;
    const replicas = [a, b, c];
    const [todo, doing, done] = columnIds(a) as [string, string, string];
    const card = createCard(a, { columnId: todo, title: 'Shared', createdBy: 'alice' });
    syncAll(all);

    const logs = replicas.map(recordUpdates);
    moveCard(a, card, doing);
    renameColumn(b, doing, 'Doing');
    moveCard(b, card, done);
    archiveCard(c, card);
    moveColumn(c, done, undefined, todo);
    const extra = createCard(c, { columnId: todo, title: 'Extra', createdBy: 'carol' });

    // Deliver every update to fresh replicas in forward and reverse order.
    const updates = logs.flat();
    for (const update of updates) Y.applyUpdate(forward, update);
    for (const update of [...updates].reverse()) Y.applyUpdate(reverse, update);
    syncAll(replicas);

    expectConverged([a, b, c, forward, reverse], [card, extra]);
  });
});

// ------------------------------------------------------------ property-based

type Command =
  | { kind: 'create'; column: number; title: string }
  | { kind: 'move'; card: number; column: number; neighbour: number }
  | { kind: 'rename'; card: number; title: string }
  | { kind: 'archive'; card: number }
  | { kind: 'restore'; card: number }
  | { kind: 'label'; card: number }
  | { kind: 'createColumn'; title: string }
  | { kind: 'moveColumn'; column: number; neighbour: number }
  | { kind: 'deleteColumn'; column: number };

const index = fc.nat({ max: 9 });
const title = fc.string({ maxLength: 8 });

const command: fc.Arbitrary<Command> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({ kind: fc.constant('create' as const), column: index, title }),
  },
  {
    weight: 5,
    arbitrary: fc.record({
      kind: fc.constant('move' as const),
      card: index,
      column: index,
      neighbour: index,
    }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('rename' as const), card: index, title }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('archive' as const), card: index }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('restore' as const), card: index }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('label' as const), card: index }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('createColumn' as const), title }) },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('moveColumn' as const),
      column: index,
      neighbour: index,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('deleteColumn' as const), column: index }),
  },
);

/** A step is either a command on one replica or a one-way sync between two replicas. */
const step = fc.oneof(
  { weight: 4, arbitrary: fc.record({ replica: fc.nat({ max: 2 }), command }) },
  { weight: 1, arbitrary: fc.record({ from: fc.nat({ max: 2 }), to: fc.nat({ max: 2 }) }) },
);

const pick = <T>(items: readonly T[], i: number): T | undefined =>
  items.length === 0 ? undefined : items[i % items.length];

/** Applies a command against the replica's *current* view, skipping impossible ones. */
function apply(doc: Y.Doc, cmd: Command, createdIds: string[]): void {
  const view = readBoard(doc);
  const columns = view.columns;
  const cards = [...columns.flatMap((column) => column.cards), ...view.archivedCards];
  switch (cmd.kind) {
    case 'create': {
      const column = pick(columns, cmd.column);
      if (column)
        createdIds.push(createCard(doc, { columnId: column.id, title: cmd.title, createdBy: 'p' }));
      return;
    }
    case 'move': {
      const card = pick(cards, cmd.card);
      const column = pick(columns, cmd.column);
      if (!card || !column) return;
      const neighbour = pick(column.cards, cmd.neighbour);
      moveCard(doc, card.id, column.id, neighbour?.id);
      return;
    }
    case 'rename': {
      const card = pick(cards, cmd.card);
      if (card) updateCard(doc, card.id, { title: cmd.title });
      return;
    }
    case 'archive': {
      const card = pick(cards, cmd.card);
      if (card) archiveCard(doc, card.id);
      return;
    }
    case 'restore': {
      const card = pick(view.archivedCards, cmd.card);
      if (card && columns.length > 0) restoreCard(doc, card.id);
      return;
    }
    case 'label': {
      const card = pick(cards, cmd.card);
      if (card) toggleCardLabel(doc, card.id, 'label-1');
      return;
    }
    case 'createColumn':
      createColumn(doc, { title: cmd.title });
      return;
    case 'moveColumn': {
      const column = pick(columns, cmd.column);
      const neighbour = pick(columns, cmd.neighbour);
      if (column)
        moveColumn(doc, column.id, neighbour?.id === column.id ? undefined : neighbour?.id);
      return;
    }
    case 'deleteColumn': {
      // Keep at least one column so restored cards always have a home.
      const column = pick(columns, cmd.column);
      if (column && columns.length > 1) deleteColumn(doc, column.id);
      return;
    }
  }
}

describe('property: random concurrent edits always converge', () => {
  it('3 replicas, random operations and partial syncs: identical boards, no duplicates, no losses', () => {
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 60 }), (steps) => {
        const replicas = createReplicas(3);
        const createdIds: string[] = [];
        for (const s of steps) {
          if ('command' in s) {
            apply(replicas[s.replica]!, s.command, createdIds);
          } else if (s.from !== s.to) {
            const from = replicas[s.from]!;
            const to = replicas[s.to]!;
            Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)));
          }
        }
        syncAll(replicas);
        expectConverged(replicas, createdIds);
      }),
      { numRuns: 300 },
    );
  });
});
