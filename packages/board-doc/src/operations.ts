import * as Y from 'yjs';

import { positionBetween } from './position.js';
import { columnOrder, columnSiblings } from './read.js';
import {
  DEFAULT_COLUMNS,
  getCards,
  getColumns,
  getLabels,
  getMeta,
  readArray,
  readString,
  type YRecord,
} from './schema.js';

/** Options shared by every operation. */
export interface OperationOptions {
  /** Transaction origin, used by `Y.UndoManager` to track only local changes. */
  origin?: unknown;
}

export const newId = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

const MAX_TITLE = 500;
const clean = (value: string) => value.trim().slice(0, MAX_TITLE);

function requireRecord(map: Y.Map<YRecord>, id: string, kind: string): YRecord {
  const record = map.get(id);
  if (!record) throw new Error(`${kind} ${id} not found`);
  return record;
}

function record(entries: Record<string, unknown>): YRecord {
  const map = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) map.set(key, value);
  }
  return map;
}

// ---------------------------------------------------------------- board

/**
 * Fills an empty document with the board title and the default columns. Only the server calls
 * this, once, when the board is created; clients never initialise documents concurrently.
 */
export function initializeBoard(
  doc: Y.Doc,
  { title, columns = DEFAULT_COLUMNS }: { title: string; columns?: readonly string[] },
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    getMeta(doc).set('title', clean(title));
    for (const columnTitle of columns) createColumn(doc, { title: columnTitle });
  }, options.origin);
}

/** Encoded initial state for a new board (stored as `board_documents.state`). */
export function createInitialBoardState(title: string): Uint8Array {
  const doc = new Y.Doc();
  initializeBoard(doc, { title });
  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

export function setBoardTitle(doc: Y.Doc, title: string, options: OperationOptions = {}): void {
  doc.transact(() => getMeta(doc).set('title', clean(title)), options.origin);
}

// ---------------------------------------------------------------- columns

export function createColumn(
  doc: Y.Doc,
  { title, id = newId(), beforeId }: { title: string; id?: string; beforeId?: string },
  options: OperationOptions = {},
): string {
  doc.transact(() => {
    const position = positionBetween(columnOrder(doc), beforeId);
    getColumns(doc).set(
      id,
      record({ id, title: clean(title), position, createdAt: now(), archived: false }),
    );
  }, options.origin);
  return id;
}

export function renameColumn(
  doc: Y.Doc,
  columnId: string,
  title: string,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    requireRecord(getColumns(doc), columnId, 'Column').set('title', clean(title));
  }, options.origin);
}

/** Reorders a column: `beforeId` ends up to its left, `afterId` to its right. */
export function moveColumn(
  doc: Y.Doc,
  columnId: string,
  beforeId?: string,
  afterId?: string,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const column = requireRecord(getColumns(doc), columnId, 'Column');
    column.set('position', positionBetween(columnOrder(doc, columnId), beforeId, afterId));
  }, options.origin);
}

export function setColumnWipLimit(
  doc: Y.Doc,
  columnId: string,
  wipLimit: number | null,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const column = requireRecord(getColumns(doc), columnId, 'Column');
    if (wipLimit === null) column.delete('wipLimit');
    else column.set('wipLimit', Math.max(1, Math.floor(wipLimit)));
  }, options.origin);
}

/**
 * Archives a column and every card in it. The column is soft-deleted (flag) so it can be restored
 * and so concurrent edits referencing it keep a valid target.
 */
export function deleteColumn(doc: Y.Doc, columnId: string, options: OperationOptions = {}): void {
  doc.transact(() => {
    requireRecord(getColumns(doc), columnId, 'Column').set('archived', true);
    getCards(doc).forEach((card) => {
      if (readString(card, 'columnId') === columnId) card.set('archived', true);
    });
  }, options.origin);
}

// ---------------------------------------------------------------- cards

export interface CreateCardInput {
  columnId: string;
  title: string;
  createdBy: string;
  id?: string;
  /** Insert below this card (default: end of the column). */
  beforeId?: string;
}

export function createCard(
  doc: Y.Doc,
  { columnId, title, createdBy, id = newId(), beforeId }: CreateCardInput,
  options: OperationOptions = {},
): string {
  doc.transact(() => {
    requireRecord(getColumns(doc), columnId, 'Column');
    const position = positionBetween(columnSiblings(doc, columnId), beforeId);
    getCards(doc).set(
      id,
      record({
        id,
        columnId,
        position,
        title: clean(title),
        description: new Y.Text(),
        labels: new Y.Array<string>(),
        assigneeIds: new Y.Array<string>(),
        checklist: new Y.Array<YRecord>(),
        createdBy,
        createdAt: now(),
        archived: false,
      }),
    );
  }, options.origin);
  return id;
}

export interface CardPatch {
  title?: string;
  /** ISO date string, or `null` to clear. */
  dueDate?: string | null;
}

export function updateCard(
  doc: Y.Doc,
  cardId: string,
  patch: CardPatch,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const card = requireRecord(getCards(doc), cardId, 'Card');
    if (patch.title !== undefined) card.set('title', clean(patch.title));
    if (patch.dueDate === null) card.delete('dueDate');
    else if (patch.dueDate !== undefined) card.set('dueDate', patch.dueDate);
  }, options.origin);
}

/**
 * Moves a card to `toColumnId`. `beforeId` is the card that should end up right above it,
 * `afterId` the card right below it; omit both to append. Only `columnId` and `position` change,
 * atomically, so concurrent moves resolve last-writer-wins per field and never duplicate the card.
 */
export function moveCard(
  doc: Y.Doc,
  cardId: string,
  toColumnId: string,
  beforeId?: string,
  afterId?: string,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const card = requireRecord(getCards(doc), cardId, 'Card');
    requireRecord(getColumns(doc), toColumnId, 'Column');
    const position = positionBetween(columnSiblings(doc, toColumnId, cardId), beforeId, afterId);
    card.set('columnId', toColumnId);
    card.set('position', position);
  }, options.origin);
}

export function archiveCard(doc: Y.Doc, cardId: string, options: OperationOptions = {}): void {
  doc.transact(
    () => requireRecord(getCards(doc), cardId, 'Card').set('archived', true),
    options.origin,
  );
}

/** Restores an archived card at the end of its column (or of the first column if it is gone). */
export function restoreCard(doc: Y.Doc, cardId: string, options: OperationOptions = {}): void {
  doc.transact(() => {
    const card = requireRecord(getCards(doc), cardId, 'Card');
    const columns = getColumns(doc);
    let columnId = readString(card, 'columnId');
    const column = columns.get(columnId);
    if (!column || column.get('archived') === true) {
      const first = columnOrder(doc)[0];
      if (!first) throw new Error('Cannot restore a card: the board has no columns');
      columnId = first.id;
    }
    card.set('columnId', columnId);
    card.set('position', positionBetween(columnSiblings(doc, columnId, cardId)));
    card.set('archived', false);
  }, options.origin);
}

/** The collaborative description, edited directly by the rich text editor. */
export function getCardDescription(doc: Y.Doc, cardId: string): Y.Text {
  const card = requireRecord(getCards(doc), cardId, 'Card');
  const text = card.get('description');
  if (!(text instanceof Y.Text)) throw new Error(`Card ${cardId} has no description text`);
  return text;
}

function toggleInArray(card: YRecord, key: string, value: string): void {
  const array = readArray<string>(card, key);
  if (!array) {
    card.set(key, Y.Array.from([value]));
    return;
  }
  const values = array.toArray();
  if (!values.includes(value)) {
    array.push([value]);
    return;
  }
  // Remove every occurrence (concurrent toggles may have inserted duplicates).
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index] === value) array.delete(index, 1);
  }
}

export function toggleCardLabel(
  doc: Y.Doc,
  cardId: string,
  labelId: string,
  options: OperationOptions = {},
): void {
  doc.transact(
    () => toggleInArray(requireRecord(getCards(doc), cardId, 'Card'), 'labels', labelId),
    options.origin,
  );
}

export function toggleCardAssignee(
  doc: Y.Doc,
  cardId: string,
  userId: string,
  options: OperationOptions = {},
): void {
  doc.transact(
    () => toggleInArray(requireRecord(getCards(doc), cardId, 'Card'), 'assigneeIds', userId),
    options.origin,
  );
}

// ---------------------------------------------------------------- checklist

function checklistOf(doc: Y.Doc, cardId: string): Y.Array<YRecord> {
  const card = requireRecord(getCards(doc), cardId, 'Card');
  const checklist = readArray<YRecord>(card, 'checklist');
  if (checklist) return checklist;
  const created = new Y.Array<YRecord>();
  card.set('checklist', created);
  return created;
}

function findChecklistItem(checklist: Y.Array<YRecord>, itemId: string) {
  const index = checklist.toArray().findIndex((item) => item.get('id') === itemId);
  return { index, item: checklist.get(index) as YRecord | undefined };
}

export function addChecklistItem(
  doc: Y.Doc,
  cardId: string,
  { text, id = newId() }: { text: string; id?: string },
  options: OperationOptions = {},
): string {
  doc.transact(() => {
    checklistOf(doc, cardId).push([record({ id, text: clean(text), done: false })]);
  }, options.origin);
  return id;
}

export function toggleChecklistItem(
  doc: Y.Doc,
  cardId: string,
  itemId: string,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const { item } = findChecklistItem(checklistOf(doc, cardId), itemId);
    if (!item) throw new Error(`Checklist item ${itemId} not found`);
    item.set('done', item.get('done') !== true);
  }, options.origin);
}

export function removeChecklistItem(
  doc: Y.Doc,
  cardId: string,
  itemId: string,
  options: OperationOptions = {},
): void {
  doc.transact(() => {
    const checklist = checklistOf(doc, cardId);
    const { index } = findChecklistItem(checklist, itemId);
    if (index !== -1) checklist.delete(index, 1);
  }, options.origin);
}

// ---------------------------------------------------------------- labels

export function createLabel(
  doc: Y.Doc,
  { name, color, id = newId() }: { name: string; color: string; id?: string },
  options: OperationOptions = {},
): string {
  doc.transact(() => {
    getLabels(doc).set(id, record({ id, name: clean(name), color }));
  }, options.origin);
  return id;
}

export function deleteLabel(doc: Y.Doc, labelId: string, options: OperationOptions = {}): void {
  doc.transact(() => {
    getLabels(doc).delete(labelId);
    getCards(doc).forEach((card) => {
      const labels = readArray<string>(card, 'labels');
      if (labels?.toArray().includes(labelId)) toggleInArray(card, 'labels', labelId);
    });
  }, options.origin);
}
