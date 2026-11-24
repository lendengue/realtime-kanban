# 0020. Per-user undo and redo

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The spec (4.4) asks for `Y.UndoManager` tracking only the local origin, bound to `Ctrl+Z` /
`Ctrl+Shift+Z`, so a user never undoes someone else's action.

## Decision

- `createBoardUndoManager(doc, origin)` in `@realtime-kanban/board-doc` scopes the manager to `meta`,
  `columns`, `cards` and `labels`, with `trackedOrigins` containing only the tab's `LOCAL_ORIGIN`.
  Remote updates (provider), the offline cache (y-indexeddb) and server upgrades use other origins
  and are never undoable.
- **One step per operation** (`captureTimeout: 0`): board operations are discrete actions;
  merging two quick moves into one step would surprise the user.
- **Rich text has its own history.** The description editor's Yjs undo plugin tracks only its own
  edits to that card; the board manager ignores them. While a text field or the editor has focus,
  `Ctrl+Z` stays native to it; elsewhere it undoes the last board action. `Ctrl+Y` and the toolbar
  buttons also work; viewers get neither.
- **Concurrency semantics** (covered by two-replica tests): undo removes only this user's change;
  undoing a move keeps another user's later edits to the same card; undoing an older move does
  not override a newer move by someone else (Yjs keeps the newer value).

## Consequences

- Undoing "create card" removes the card even if someone else edited it in the meantime; that is
  the expected meaning of undoing a creation, and the other user can undo their own edits.
- The history lives in memory and is lost on reload, like in most collaborative editors.
