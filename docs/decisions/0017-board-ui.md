# 0017. Board UI: drag and drop and connection lifecycle

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The spec asks for `@dnd-kit` with mandatory keyboard navigation and a live board backed by the
Y.Doc.

## Decision

- **Library:** `@dnd-kit/core` + `@dnd-kit/sortable` (stable 6.x/10.x). The newer `@dnd-kit/react`
  is still 0.x.
- **One `DndContext`** for columns and cards, with namespaced ids (`column:<id>`, `card:<id>`).
  A custom collision detection lets columns collide only with columns. Pointer drags need 5 px of
  movement (so clicks still work); the keyboard sensor uses `sortableKeyboardCoordinates`.
  Screen-reader announcements and instructions are translated.
- **Drops** are translated to `moveCard` / `moveColumn` by pure functions (`resolveCardDrop`,
  `resolveColumnDrop`) with sortable semantics: dropping on a card takes its slot, dropping on a
  column appends. The document is only written on drop, not on every hover.
- **Connection lifecycle:** a small external store per board owns the `HocuspocusProvider` and
  `Y.Doc`; it opens on the first subscriber and closes on the last, consumed with
  `useSyncExternalStore` (no `setState` inside effects, StrictMode-safe). The token is read from
  memory on every connect; on an auth failure the session is refreshed once and the token resent.
- **View:** `readBoard(doc)` is recomputed after each document update and exposed through
  `useSyncExternalStore`.
- **Read-only:** the server-provided scope (`readonly`) disables editing and dragging.

## Consequences

- During a cross-column pointer drag the card stays in its source column until dropped (an
  overlay follows the pointer); a live "preview" placement can be added later without touching
  the document logic.
