import * as Y from 'yjs';

/**
 * Board document layout (one `Y.Doc` per board):
 *
 * - `meta`    Y.Map    { title, background? }
 * - `columns` Y.Map<columnId, Y.Map>  { id, title, position, wipLimit?, createdAt, archived }
 * - `cards`   Y.Map<cardId, Y.Map>    { id, columnId, position, title,
 *                                        description: Y.XmlFragment (rich text, ADR 0021),
 *                                        labels: Y.Array<string>, assigneeIds: Y.Array<string>,
 *                                        dueDate?, checklist: Y.Array<Y.Map>, createdBy, createdAt,
 *                                        archived }
 * - `labels`  Y.Map<labelId, Y.Map>   { id, name, color }
 *
 * Cards are NOT stored in per-column arrays: moving a card only rewrites `columnId` and
 * `position` (a fractional index), so concurrent moves can never duplicate it (ADR 0002).
 */
export type YRecord = Y.Map<unknown>;

export const getMeta = (doc: Y.Doc): YRecord => doc.getMap('meta');
export const getColumns = (doc: Y.Doc): Y.Map<YRecord> => doc.getMap('columns');
export const getCards = (doc: Y.Doc): Y.Map<YRecord> => doc.getMap('cards');
export const getLabels = (doc: Y.Doc): Y.Map<YRecord> => doc.getMap('labels');

export const DEFAULT_COLUMNS = ['To do', 'In progress', 'Done'] as const;

export function readString(map: YRecord, key: string, fallback = ''): string {
  const value = map.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function readOptionalString(map: YRecord, key: string): string | null {
  const value = map.get(key);
  return typeof value === 'string' ? value : null;
}

export function readNumber(map: YRecord, key: string): number | null {
  const value = map.get(key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readBoolean(map: YRecord, key: string): boolean {
  return map.get(key) === true;
}

export function readText(map: YRecord, key: string): Y.Text | null {
  const value = map.get(key);
  return value instanceof Y.Text ? value : null;
}

export function readFragment(map: YRecord, key: string): Y.XmlFragment | null {
  const value = map.get(key);
  return value instanceof Y.XmlFragment ? value : null;
}

export function readArray<T>(map: YRecord, key: string): Y.Array<T> | null {
  const value = map.get(key);
  return value instanceof Y.Array ? (value as Y.Array<T>) : null;
}
