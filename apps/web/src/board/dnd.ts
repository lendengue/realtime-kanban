import type { BoardView } from '@realtime-kanban/board-doc';

/** Drag ids are namespaced so cards and columns can share one DndContext. */
export const cardDragId = (id: string) => `card:${id}`;
export const columnDragId = (id: string) => `column:${id}`;

export function parseDragId(
  dragId: string | number,
): { kind: 'card' | 'column'; id: string } | null {
  const value = String(dragId);
  if (value.startsWith('card:')) return { kind: 'card', id: value.slice(5) };
  if (value.startsWith('column:')) return { kind: 'column', id: value.slice(7) };
  return null;
}

export interface CardDrop {
  cardId: string;
  toColumnId: string;
  /** Card that ends up right above the moved card. */
  beforeId?: string;
  /** Card that ends up right below the moved card. */
  afterId?: string;
}

/**
 * Translates a drop of `cardId` onto `over` (a card or a column) into `moveCard` arguments.
 * Mirrors sortable semantics: dropping on a card takes that card's slot; dropping on a column
 * appends to it.
 */
export function resolveCardDrop(view: BoardView, cardId: string, over: string): CardDrop | null {
  const target = parseDragId(over);
  if (!target) return null;

  const source = view.columns.find((column) => column.cards.some((card) => card.id === cardId));
  if (!source) return null;

  if (target.kind === 'column') {
    const column = view.columns.find((candidate) => candidate.id === target.id);
    if (!column) return null;
    if (column.id === source.id && column.cards.at(-1)?.id === cardId) return null;
    const last = column.cards.filter((card) => card.id !== cardId).at(-1);
    return { cardId, toColumnId: column.id, ...(last && { beforeId: last.id }) };
  }

  if (target.id === cardId) return null;
  const column = view.columns.find((candidate) =>
    candidate.cards.some((card) => card.id === target.id),
  );
  if (!column) return null;

  const ids = column.cards.map((card) => card.id);
  const overIndex = ids.indexOf(target.id);
  const activeIndex = ids.indexOf(cardId);
  const others = ids.filter((id) => id !== cardId);
  // Moving down inside the same column lands below the hovered card; otherwise above it.
  const insertAt =
    activeIndex !== -1 && activeIndex < overIndex ? overIndex : others.indexOf(target.id);
  const beforeId = others[insertAt - 1];
  const afterId = others[insertAt];
  return {
    cardId,
    toColumnId: column.id,
    ...(beforeId !== undefined && { beforeId }),
    ...(afterId !== undefined && { afterId }),
  };
}

export interface ColumnDrop {
  columnId: string;
  beforeId?: string;
  afterId?: string;
}

export function resolveColumnDrop(
  view: BoardView,
  columnId: string,
  over: string,
): ColumnDrop | null {
  const target = parseDragId(over);
  if (target?.kind !== 'column' || target.id === columnId) return null;
  const ids = view.columns.map((column) => column.id);
  const overIndex = ids.indexOf(target.id);
  const activeIndex = ids.indexOf(columnId);
  if (overIndex === -1 || activeIndex === -1) return null;
  const others = ids.filter((id) => id !== columnId);
  const insertAt = activeIndex < overIndex ? overIndex : others.indexOf(target.id);
  const beforeId = others[insertAt - 1];
  const afterId = others[insertAt];
  return {
    columnId,
    ...(beforeId !== undefined && { beforeId }),
    ...(afterId !== undefined && { afterId }),
  };
}
