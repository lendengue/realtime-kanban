import { describe, expect, it } from 'vitest';
import type * as Y from 'yjs';

import {
  createCard,
  getCardDescription,
  moveCard,
  setBoardTitle,
  updateCard,
} from './operations.js';
import { readBoard } from './read.js';
import { plainTextToParagraphs } from './rich-text.js';
import { columnIds, createReplicas, syncAll } from './test/helpers.js';
import { createBoardUndoManager } from './undo.js';

const LOCAL = Symbol('local');
const local = { origin: LOCAL };

function twoUsers() {
  const [alice, bob] = createReplicas(2);
  if (!alice || !bob) throw new Error('replicas missing');
  const [todo, doing, done] = columnIds(alice);
  if (!todo || !doing || !done) throw new Error('columns missing');
  return {
    alice,
    bob,
    aliceUndo: createBoardUndoManager(alice, LOCAL),
    bobUndo: createBoardUndoManager(bob, LOCAL),
    todo,
    doing,
    done,
  };
}

const titlesIn = (doc: Y.Doc, columnId: string) =>
  readBoard(doc)
    .columns.find((column) => column.id === columnId)
    ?.cards.map((card) => card.title);

describe('per-user undo', () => {
  it("undoes only the user's own action, never someone else's", () => {
    const { alice, bob, aliceUndo, todo } = twoUsers();
    createCard(alice, { columnId: todo, title: 'Alice', createdBy: 'a' }, local);
    syncAll([alice, bob]);
    createCard(bob, { columnId: todo, title: 'Bob', createdBy: 'b' }, local);
    syncAll([alice, bob]);

    aliceUndo.undo();
    syncAll([alice, bob]);
    expect(titlesIn(alice, todo)).toEqual(['Bob']);
    expect(titlesIn(bob, todo)).toEqual(['Bob']);

    aliceUndo.redo();
    syncAll([alice, bob]);
    expect(titlesIn(bob, todo)?.sort()).toEqual(['Alice', 'Bob']);
  });

  it('ignores remote and untracked transactions', () => {
    const { alice, bob, aliceUndo, todo } = twoUsers();
    createCard(bob, { columnId: todo, title: 'Bob', createdBy: 'b' }, local);
    syncAll([alice, bob]);
    // A change without the local origin (e.g. loaded from the offline cache) is not undoable.
    setBoardTitle(alice, 'Server title');
    expect(aliceUndo.canUndo()).toBe(false);
    aliceUndo.undo();
    expect(readBoard(alice).title).toBe('Server title');
    expect(titlesIn(alice, todo)).toEqual(['Bob']);
  });

  it('makes every operation its own step, undone in reverse order', () => {
    const { alice, aliceUndo, todo, doing } = twoUsers();
    const id = createCard(alice, { columnId: todo, title: 'Card', createdBy: 'a' }, local);
    moveCard(alice, id, doing, undefined, undefined, local);
    updateCard(alice, id, { title: 'Renamed' }, local);
    expect(aliceUndo.undoStack).toHaveLength(3);

    aliceUndo.undo();
    expect(titlesIn(alice, doing)).toEqual(['Card']);
    aliceUndo.undo();
    expect(titlesIn(alice, todo)).toEqual(['Card']);
    aliceUndo.undo();
    expect(titlesIn(alice, todo)).toEqual([]);
  });

  it("undoing a move keeps another user's later edit of the same card", () => {
    const { alice, bob, aliceUndo, todo, doing } = twoUsers();
    const id = createCard(bob, { columnId: todo, title: 'Shared', createdBy: 'b' }, local);
    syncAll([alice, bob]);
    moveCard(alice, id, doing, undefined, undefined, local);
    syncAll([alice, bob]);
    updateCard(bob, id, { title: 'Renamed by Bob' }, local);
    syncAll([alice, bob]);

    aliceUndo.undo();
    syncAll([alice, bob]);
    expect(titlesIn(alice, todo)).toEqual(['Renamed by Bob']);
    expect(readBoard(bob)).toEqual(readBoard(alice));
  });

  it('does not override a newer move by someone else when undoing an older one', () => {
    const { alice, bob, aliceUndo, todo, doing, done } = twoUsers();
    const id = createCard(bob, { columnId: todo, title: 'Shared', createdBy: 'b' }, local);
    syncAll([alice, bob]);
    moveCard(alice, id, doing, undefined, undefined, local);
    syncAll([alice, bob]);
    moveCard(bob, id, done, undefined, undefined, local);
    syncAll([alice, bob]);

    aliceUndo.undo();
    syncAll([alice, bob]);
    expect(titlesIn(alice, done)).toEqual(['Shared']);
    expect(readBoard(bob)).toEqual(readBoard(alice));
  });

  it('leaves rich text edits to the editor history', () => {
    const { alice, aliceUndo, todo } = twoUsers();
    const id = createCard(alice, { columnId: todo, title: 'Card', createdBy: 'a' }, local);
    alice.transact(() => {
      getCardDescription(alice, id).insert(0, plainTextToParagraphs('Typed in the editor'));
    }, Symbol('editor'));
    expect(aliceUndo.undoStack).toHaveLength(1);
  });
});
