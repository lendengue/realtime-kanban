import {
  createCard,
  initializeBoard,
  moveCard,
  moveColumn,
  readBoard,
  type BoardView,
} from '@realtime-kanban/board-doc';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { cardDragId, columnDragId, parseDragId, resolveCardDrop, resolveColumnDrop } from './dnd';

function setup() {
  const doc = new Y.Doc();
  initializeBoard(doc, { title: 'B' });
  const [todo, doing, done] = readBoard(doc).columns.map((c) => c.id) as [string, string, string];
  const ids = Object.fromEntries(
    ['A', 'B', 'C'].map((title) => [
      title,
      createCard(doc, { columnId: todo, title, createdBy: 'u' }),
    ]),
  ) as Record<'A' | 'B' | 'C', string>;
  const x = createCard(doc, { columnId: doing, title: 'X', createdBy: 'u' });
  return { doc, todo, doing, done, ids, x };
}

const titles = (view: BoardView, column: number) => view.columns[column]?.cards.map((c) => c.title);

/** Applies a drop the way the canvas does and returns the new view. */
function dropCard(doc: Y.Doc, cardId: string, over: string) {
  const drop = resolveCardDrop(readBoard(doc), cardId, over);
  if (drop) moveCard(doc, drop.cardId, drop.toColumnId, drop.beforeId, drop.afterId);
  return readBoard(doc);
}

describe('drag ids', () => {
  it('round-trips card and column ids', () => {
    expect(parseDragId(cardDragId('1'))).toEqual({ kind: 'card', id: '1' });
    expect(parseDragId(columnDragId('2'))).toEqual({ kind: 'column', id: '2' });
    expect(parseDragId('other')).toBeNull();
  });
});

describe('resolveCardDrop', () => {
  it('moving down inside a column lands below the hovered card', () => {
    const { doc, ids } = setup();
    expect(titles(dropCard(doc, ids.A, cardDragId(ids.B)), 0)).toEqual(['B', 'A', 'C']);
  });

  it('moving up inside a column lands above the hovered card', () => {
    const { doc, ids } = setup();
    expect(titles(dropCard(doc, ids.C, cardDragId(ids.A)), 0)).toEqual(['C', 'A', 'B']);
  });

  it('dropping on a card of another column takes its slot', () => {
    const { doc, ids, x } = setup();
    const view = dropCard(doc, ids.B, cardDragId(x));
    expect(titles(view, 0)).toEqual(['A', 'C']);
    expect(titles(view, 1)).toEqual(['B', 'X']);
  });

  it('dropping on a column appends to it (also works for empty columns)', () => {
    const { doc, ids, done } = setup();
    expect(titles(dropCard(doc, ids.A, columnDragId(done)), 2)).toEqual(['A']);
    expect(titles(dropCard(doc, ids.B, columnDragId(done)), 2)).toEqual(['A', 'B']);
  });

  it('ignores no-op and invalid drops', () => {
    const { doc, ids, todo } = setup();
    const view = readBoard(doc);
    expect(resolveCardDrop(view, ids.A, cardDragId(ids.A))).toBeNull();
    expect(resolveCardDrop(view, ids.C, columnDragId(todo))).toBeNull();
    expect(resolveCardDrop(view, ids.A, 'garbage')).toBeNull();
    expect(resolveCardDrop(view, 'missing', cardDragId(ids.A))).toBeNull();
    expect(resolveCardDrop(view, ids.A, columnDragId('missing'))).toBeNull();
    expect(resolveCardDrop(view, ids.A, cardDragId('missing'))).toBeNull();
  });
});

describe('resolveColumnDrop', () => {
  const order = (doc: Y.Doc) => readBoard(doc).columns.map((c) => c.title);

  function dropColumn(doc: Y.Doc, columnId: string, over: string) {
    const drop = resolveColumnDrop(readBoard(doc), columnId, over);
    if (drop) moveColumn(doc, drop.columnId, drop.beforeId, drop.afterId);
  }

  it('moves columns right and left', () => {
    const { doc, todo, doing, done } = setup();
    dropColumn(doc, todo, columnDragId(doing));
    expect(order(doc)).toEqual(['In progress', 'To do', 'Done']);
    dropColumn(doc, done, columnDragId(doing));
    expect(order(doc)).toEqual(['Done', 'In progress', 'To do']);
  });

  it('ignores drops on itself, on cards or on unknown columns', () => {
    const { doc, todo, ids } = setup();
    const view = readBoard(doc);
    expect(resolveColumnDrop(view, todo, columnDragId(todo))).toBeNull();
    expect(resolveColumnDrop(view, todo, cardDragId(ids.A))).toBeNull();
    expect(resolveColumnDrop(view, todo, columnDragId('missing'))).toBeNull();
  });
});
