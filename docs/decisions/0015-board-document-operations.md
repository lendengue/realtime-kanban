# 0015. Board document operation semantics

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

ADRs 0001 and 0002 fix the model (one Y.Doc per board, cards in a flat map ordered by fractional
indexes). The spec lists the operations of `packages/board-doc` but not their exact semantics
under concurrency.

## Decision

- **`moveCard(doc, cardId, toColumnId, beforeId?, afterId?)`:** `beforeId` is the card that ends
  up right **above** the moved card, `afterId` the card right **below** it (`afterId` wins when
  both are given). Unknown neighbours (moved away concurrently) are ignored and the card is
  appended. `moveColumn` and `createColumn` use the same convention horizontally.
- **Ordering:** `position` (library `fractional-indexing`, base 62) compared by code unit, then
  `id` as tie-breaker for keys generated concurrently. When neighbours share a key, the new key is
  generated after the whole tie group so keys stay strictly increasing.
- **Archiving columns:** `deleteColumn` sets `archived: true` on the column and every card in it
  (soft delete), instead of removing the map entry. Concurrent edits that still reference the
  column keep a valid target, and the column can be restored later.
- **Orphans:** an active card whose column is missing or archived (e.g. created in a column
  someone else archived concurrently) is shown in the first active column; if no active column
  remains, it is listed with the archived cards. No card is ever unreachable — this rule was
  found by the property-based test.
- **Sets in arrays:** labels and assignees live in `Y.Array`s; concurrent toggles may insert the
  same id twice, so the read model de-duplicates and removal deletes every occurrence.
- **Origins:** every operation takes `{ origin }` and runs in one `doc.transact`, so the
  per-user `UndoManager` (phase 3) can track local changes only.
- **Initial content** (title + "To do / In progress / Done") is created server-side only, never
  by clients, to avoid duplicated default columns.
- **License:** `fractional-indexing` is CC0-1.0 (public-domain dedication). It is mandated by the
  spec and compatible with MIT, so it is accepted as an exception to ADR 0007's list.

## Consequences

- Convergence is verified by scenario tests and a fast-check property test (3 replicas, random
  operations and partial syncs) asserting identical views with no duplicated or lost cards.
