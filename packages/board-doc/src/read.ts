import type * as Y from 'yjs';

import { comparePositioned } from './position.js';
import { richTextToPlainText } from './rich-text.js';
import {
  getCards,
  getColumns,
  getLabels,
  getMeta,
  readArray,
  readBoolean,
  readFragment,
  readNumber,
  readOptionalString,
  readString,
  readText,
  type YRecord,
} from './schema.js';

export interface ChecklistItemView {
  id: string;
  text: string;
  done: boolean;
}

export interface CardView {
  id: string;
  columnId: string;
  position: string;
  title: string;
  description: string;
  labels: string[];
  assigneeIds: string[];
  dueDate: string | null;
  checklist: ChecklistItemView[];
  createdBy: string;
  createdAt: string;
  archived: boolean;
}

export interface ColumnView {
  id: string;
  title: string;
  position: string;
  wipLimit: number | null;
  createdAt: string;
  archived: boolean;
  /** Active cards, ordered. */
  cards: CardView[];
}

export interface LabelView {
  id: string;
  name: string;
  color: string;
}

export interface BoardView {
  title: string;
  background: string | null;
  /** Active columns, ordered. */
  columns: ColumnView[];
  labels: LabelView[];
  archivedCards: CardView[];
}

const unique = (values: string[]) => [...new Set(values)];

/** Plain text of the description (legacy `Y.Text` descriptions are read as they are). */
function descriptionText(map: YRecord): string {
  const fragment = readFragment(map, 'description');
  if (fragment) return richTextToPlainText(fragment);
  return readText(map, 'description')?.toJSON() ?? '';
}

export function readCard(id: string, map: YRecord): CardView {
  const checklist = readArray<YRecord>(map, 'checklist')?.toArray() ?? [];
  return {
    id,
    columnId: readString(map, 'columnId'),
    position: readString(map, 'position'),
    title: readString(map, 'title'),
    description: descriptionText(map),
    // Concurrent toggles can insert the same value twice; the view de-duplicates.
    labels: unique(readArray<string>(map, 'labels')?.toArray() ?? []),
    assigneeIds: unique(readArray<string>(map, 'assigneeIds')?.toArray() ?? []),
    dueDate: readOptionalString(map, 'dueDate'),
    checklist: checklist.map((item) => ({
      id: readString(item, 'id'),
      text: readString(item, 'text'),
      done: readBoolean(item, 'done'),
    })),
    createdBy: readString(map, 'createdBy'),
    createdAt: readString(map, 'createdAt'),
    archived: readBoolean(map, 'archived'),
  };
}

/**
 * Pure, deterministic projection of the document used by the UI and tests.
 *
 * Active cards whose column is missing or archived (possible after concurrent edits, e.g. a card
 * created in a column someone else archived) are shown in the first active column. If no active
 * column is left (every column archived concurrently), they are listed with the archived cards.
 * Either way no card is ever unreachable.
 */
export function readBoard(doc: Y.Doc): BoardView {
  const meta = getMeta(doc);

  const columns: ColumnView[] = [];
  getColumns(doc).forEach((map, id) => {
    if (readBoolean(map, 'archived')) return;
    columns.push({
      id,
      title: readString(map, 'title'),
      position: readString(map, 'position'),
      wipLimit: readNumber(map, 'wipLimit'),
      createdAt: readString(map, 'createdAt'),
      archived: false,
      cards: [],
    });
  });
  columns.sort(comparePositioned);

  const byId = new Map(columns.map((column) => [column.id, column]));
  const archivedCards: CardView[] = [];
  getCards(doc).forEach((map, id) => {
    const card = readCard(id, map);
    if (card.archived) {
      archivedCards.push(card);
      return;
    }
    const column = byId.get(card.columnId) ?? columns[0];
    if (column) column.cards.push(card);
    else archivedCards.push(card);
  });
  for (const column of columns) column.cards.sort(comparePositioned);
  archivedCards.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const labels: LabelView[] = [];
  getLabels(doc).forEach((map, id) => {
    labels.push({ id, name: readString(map, 'name'), color: readString(map, 'color') });
  });
  labels.sort((a, b) => (a.id < b.id ? -1 : 1));

  return {
    title: readString(meta, 'title'),
    background: readOptionalString(meta, 'background'),
    columns,
    labels,
    archivedCards,
  };
}

/** Ordered active cards of a column as stored (no orphan re-homing); used for positioning. */
export function columnSiblings(doc: Y.Doc, columnId: string, excludeId?: string) {
  const siblings: { id: string; position: string }[] = [];
  getCards(doc).forEach((map, id) => {
    if (id === excludeId || readBoolean(map, 'archived')) return;
    if (readString(map, 'columnId') === columnId) {
      siblings.push({ id, position: readString(map, 'position') });
    }
  });
  return siblings.sort(comparePositioned);
}

export function columnOrder(doc: Y.Doc, excludeId?: string) {
  const siblings: { id: string; position: string }[] = [];
  getColumns(doc).forEach((map, id) => {
    if (id === excludeId || readBoolean(map, 'archived')) return;
    siblings.push({ id, position: readString(map, 'position') });
  });
  return siblings.sort(comparePositioned);
}
