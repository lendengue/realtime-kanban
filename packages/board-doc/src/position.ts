import { generateKeyBetween } from 'fractional-indexing';

export interface Positioned {
  id: string;
  position: string;
}

/**
 * Total order used everywhere: fractional index first (plain code-unit comparison, which matches
 * the base-62 alphabet order), then id to break ties between keys generated concurrently.
 */
export function comparePositioned(a: Positioned, b: Positioned): number {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Generates a position for an item inserted into `siblings` (sorted, without the item itself).
 *
 * - `beforeId`: sibling that should end up immediately before (above / left of) the item.
 * - `afterId`: sibling that should end up immediately after (below / right of) the item.
 *
 * Unknown ids (e.g. a neighbour moved away concurrently) are ignored; with no usable neighbour the
 * item goes to the end.
 */
export function positionBetween(
  siblings: readonly Positioned[],
  beforeId?: string,
  afterId?: string,
): string {
  let index = siblings.length;
  const afterIndex = afterId === undefined ? -1 : siblings.findIndex((s) => s.id === afterId);
  const beforeIndex = beforeId === undefined ? -1 : siblings.findIndex((s) => s.id === beforeId);
  if (afterIndex !== -1) index = afterIndex;
  else if (beforeIndex !== -1) index = beforeIndex + 1;

  const previous = siblings[index - 1]?.position ?? null;
  // Skip siblings sharing the previous key (concurrent ties): keys must be strictly increasing.
  const next =
    siblings.slice(index).find((s) => previous === null || s.position > previous)?.position ?? null;
  return generateKeyBetween(previous, next);
}
