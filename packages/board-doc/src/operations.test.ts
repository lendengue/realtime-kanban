import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  addChecklistItem,
  archiveCard,
  createCard,
  createColumn,
  createInitialBoardState,
  createLabel,
  deleteColumn,
  deleteLabel,
  getCardDescription,
  initializeBoard,
  moveCard,
  moveColumn,
  removeChecklistItem,
  renameColumn,
  restoreCard,
  setBoardTitle,
  setColumnWipLimit,
  toggleCardAssignee,
  toggleCardLabel,
  toggleChecklistItem,
  updateCard,
} from './operations.js';
import { readBoard } from './read.js';
import { getCards } from './schema.js';

function board() {
  const doc = new Y.Doc();
  initializeBoard(doc, { title: 'Roadmap' });
  const [todo, doing, done] = readBoard(doc).columns.map((column) => column.id);
  if (!todo || !doing || !done) throw new Error('default columns missing');
  return { doc, todo, doing, done };
}

const titles = (doc: Y.Doc, columnIndex: number) =>
  readBoard(doc).columns[columnIndex]?.cards.map((card) => card.title);

describe('board', () => {
  it('initialises the title and the default columns in order', () => {
    const { doc } = board();
    const view = readBoard(doc);
    expect(view.title).toBe('Roadmap');
    expect(view.columns.map((column) => column.title)).toEqual(['To do', 'In progress', 'Done']);
  });

  it('encodes an initial state that other docs can load', () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, createInitialBoardState('Launch'));
    expect(readBoard(doc).columns).toHaveLength(3);
    expect(readBoard(doc).title).toBe('Launch');
  });

  it('renames the board, trimming whitespace', () => {
    const { doc } = board();
    setBoardTitle(doc, '  Q1  ');
    expect(readBoard(doc).title).toBe('Q1');
  });

  it('runs every operation in a single transaction with the given origin', () => {
    const { doc, todo } = board();
    const origins: unknown[] = [];
    doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
    const origin = Symbol('local');
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' }, { origin });
    moveCard(doc, card, todo, undefined, undefined, { origin });
    expect(origins).toEqual([origin, origin]);
  });
});

describe('columns', () => {
  it('creates, renames and reorders columns', () => {
    const { doc, todo, doing, done } = board();
    const review = createColumn(doc, { title: 'Review', beforeId: doing });
    expect(readBoard(doc).columns.map((c) => c.title)).toEqual([
      'To do',
      'In progress',
      'Review',
      'Done',
    ]);

    renameColumn(doc, review, 'QA');
    moveColumn(doc, done, undefined, todo);
    expect(readBoard(doc).columns.map((c) => c.title)).toEqual([
      'Done',
      'To do',
      'In progress',
      'QA',
    ]);

    moveColumn(doc, done);
    expect(readBoard(doc).columns.at(-1)?.title).toBe('Done');
  });

  it('sets and clears the WIP limit', () => {
    const { doc, todo } = board();
    setColumnWipLimit(doc, todo, 2.7);
    expect(readBoard(doc).columns[0]?.wipLimit).toBe(2);
    setColumnWipLimit(doc, todo, 0);
    expect(readBoard(doc).columns[0]?.wipLimit).toBe(1);
    setColumnWipLimit(doc, todo, null);
    expect(readBoard(doc).columns[0]?.wipLimit).toBeNull();
  });

  it('deleting a column archives it together with its cards', () => {
    const { doc, todo, doing } = board();
    const a = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    createCard(doc, { columnId: doing, title: 'B', createdBy: 'u1' });
    deleteColumn(doc, todo);

    const view = readBoard(doc);
    expect(view.columns.map((c) => c.title)).toEqual(['In progress', 'Done']);
    expect(view.archivedCards.map((c) => c.id)).toEqual([a]);
  });

  it('throws on unknown columns', () => {
    const { doc } = board();
    expect(() => renameColumn(doc, 'nope', 'x')).toThrow(/Column nope not found/);
    expect(() => createCard(doc, { columnId: 'nope', title: 'x', createdBy: 'u' })).toThrow();
  });
});

describe('cards', () => {
  it('creates cards at the end of a column, or below a given card', () => {
    const { doc, todo } = board();
    const a = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    createCard(doc, { columnId: todo, title: 'C', createdBy: 'u1' });
    createCard(doc, { columnId: todo, title: 'B', createdBy: 'u1', beforeId: a });
    expect(titles(doc, 0)).toEqual(['A', 'B', 'C']);

    const card = readBoard(doc).columns[0]?.cards[0];
    expect(card).toMatchObject({
      title: 'A',
      columnId: todo,
      createdBy: 'u1',
      archived: false,
      description: '',
      labels: [],
      checklist: [],
      dueDate: null,
    });
  });

  it('updates title and due date', () => {
    const { doc, todo } = board();
    const id = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    updateCard(doc, id, { title: 'Renamed', dueDate: '2026-12-01' });
    expect(readBoard(doc).columns[0]?.cards[0]).toMatchObject({
      title: 'Renamed',
      dueDate: '2026-12-01',
    });
    updateCard(doc, id, { dueDate: null });
    expect(readBoard(doc).columns[0]?.cards[0]?.dueDate).toBeNull();
  });

  describe('moveCard', () => {
    function withCards() {
      const b = board();
      const ids = ['A', 'B', 'C'].map((title) =>
        createCard(b.doc, { columnId: b.todo, title, createdBy: 'u1' }),
      ) as [string, string, string];
      return { ...b, ids };
    }

    it('moves between columns (appending)', () => {
      const { doc, doing, ids } = withCards();
      moveCard(doc, ids[0], doing);
      expect(titles(doc, 0)).toEqual(['B', 'C']);
      expect(titles(doc, 1)).toEqual(['A']);
      expect(readBoard(doc).columns[1]?.cards[0]?.columnId).toBe(doing);
    });

    it('moves to the top of a column', () => {
      const { doc, todo, ids } = withCards();
      moveCard(doc, ids[2], todo, undefined, ids[0]);
      expect(titles(doc, 0)).toEqual(['C', 'A', 'B']);
    });

    it('moves to the end of a column', () => {
      const { doc, todo, ids } = withCards();
      moveCard(doc, ids[0], todo, ids[2]);
      expect(titles(doc, 0)).toEqual(['B', 'C', 'A']);
    });

    it('moves between two cards', () => {
      const { doc, todo, ids } = withCards();
      moveCard(doc, ids[2], todo, ids[0], ids[1]);
      expect(titles(doc, 0)).toEqual(['A', 'C', 'B']);
    });

    it('moves between two cards of another column', () => {
      const { doc, doing, ids } = withCards();
      const x = createCard(doc, { columnId: doing, title: 'X', createdBy: 'u1' });
      const y = createCard(doc, { columnId: doing, title: 'Y', createdBy: 'u1' });
      moveCard(doc, ids[1], doing, x, y);
      expect(titles(doc, 1)).toEqual(['X', 'B', 'Y']);
    });

    it('only touches columnId and position', () => {
      const { doc, doing, ids } = withCards();
      const changed = new Set<string>();
      getCards(doc)
        .get(ids[0])
        ?.observe((event) => {
          for (const key of event.keysChanged as Set<string>) changed.add(key);
        });
      moveCard(doc, ids[0], doing);
      expect([...changed].sort()).toEqual(['columnId', 'position']);
    });

    it('rejects unknown cards and columns', () => {
      const { doc, todo, ids } = withCards();
      expect(() => moveCard(doc, 'nope', todo)).toThrow(/Card nope not found/);
      expect(() => moveCard(doc, ids[0], 'nope')).toThrow(/Column nope not found/);
    });
  });

  it('archives and restores cards', () => {
    const { doc, todo } = board();
    const a = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    createCard(doc, { columnId: todo, title: 'B', createdBy: 'u1' });
    archiveCard(doc, a);
    expect(titles(doc, 0)).toEqual(['B']);
    expect(readBoard(doc).archivedCards.map((c) => c.title)).toEqual(['A']);

    restoreCard(doc, a);
    expect(titles(doc, 0)).toEqual(['B', 'A']);
    expect(readBoard(doc).archivedCards).toEqual([]);
  });

  it('restores into the first column when its column was archived', () => {
    const { doc, todo, doing } = board();
    const a = createCard(doc, { columnId: doing, title: 'A', createdBy: 'u1' });
    deleteColumn(doc, doing);
    restoreCard(doc, a);
    expect(readBoard(doc).columns[0]?.cards[0]).toMatchObject({ id: a, columnId: todo });
  });

  it('cannot restore a card when no column is left', () => {
    const { doc, todo, doing, done } = board();
    const a = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    for (const column of [todo, doing, done]) deleteColumn(doc, column);
    expect(() => restoreCard(doc, a)).toThrow(/no columns/);
  });

  it('exposes the collaborative description', () => {
    const { doc, todo } = board();
    const a = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    getCardDescription(doc, a).insert(0, 'Hello');
    expect(readBoard(doc).columns[0]?.cards[0]?.description).toBe('Hello');
    getCards(doc).get(a)?.set('description', 'not a Y.Text');
    expect(() => getCardDescription(doc, a)).toThrow(/no description/);
  });
});

describe('labels and assignees', () => {
  it('creates labels and toggles them on cards', () => {
    const { doc, todo } = board();
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    const bug = createLabel(doc, { name: 'Bug', color: 'red' });
    toggleCardLabel(doc, card, bug);
    expect(readBoard(doc).labels).toEqual([{ id: bug, name: 'Bug', color: 'red' }]);
    expect(readBoard(doc).columns[0]?.cards[0]?.labels).toEqual([bug]);
    toggleCardLabel(doc, card, bug);
    expect(readBoard(doc).columns[0]?.cards[0]?.labels).toEqual([]);
  });

  it('deleting a label removes it from cards', () => {
    const { doc, todo } = board();
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    const bug = createLabel(doc, { name: 'Bug', color: 'red' });
    toggleCardLabel(doc, card, bug);
    deleteLabel(doc, bug);
    expect(readBoard(doc).labels).toEqual([]);
    expect(readBoard(doc).columns[0]?.cards[0]?.labels).toEqual([]);
  });

  it('toggles assignees and recreates a missing array', () => {
    const { doc, todo } = board();
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    toggleCardAssignee(doc, card, 'u2');
    expect(readBoard(doc).columns[0]?.cards[0]?.assigneeIds).toEqual(['u2']);
    getCards(doc).get(card)?.delete('assigneeIds');
    toggleCardAssignee(doc, card, 'u3');
    expect(readBoard(doc).columns[0]?.cards[0]?.assigneeIds).toEqual(['u3']);
  });
});

describe('checklist', () => {
  it('adds, toggles and removes items', () => {
    const { doc, todo } = board();
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    const item = addChecklistItem(doc, card, { text: 'Write tests' });
    toggleChecklistItem(doc, card, item);
    expect(readBoard(doc).columns[0]?.cards[0]?.checklist).toEqual([
      { id: item, text: 'Write tests', done: true },
    ]);
    toggleChecklistItem(doc, card, item);
    expect(readBoard(doc).columns[0]?.cards[0]?.checklist[0]?.done).toBe(false);
    removeChecklistItem(doc, card, item);
    removeChecklistItem(doc, card, 'already-gone');
    expect(readBoard(doc).columns[0]?.cards[0]?.checklist).toEqual([]);
    expect(() => toggleChecklistItem(doc, card, item)).toThrow(/not found/);
  });

  it('recreates a missing checklist array', () => {
    const { doc, todo } = board();
    const card = createCard(doc, { columnId: todo, title: 'A', createdBy: 'u1' });
    getCards(doc).get(card)?.delete('checklist');
    addChecklistItem(doc, card, { text: 'x' });
    expect(readBoard(doc).columns[0]?.cards[0]?.checklist).toHaveLength(1);
  });
});
