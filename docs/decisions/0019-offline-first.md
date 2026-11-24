# 0019. Offline-first board documents

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The spec (4.6) asks for `y-indexeddb`, loading the board from IndexedDB before syncing, an
Online / Offline / Syncing indicator and automatic sync of offline edits on reconnect.

## Decision

- **One IndexedDB database per user and board** (`realtime-kanban:{userId}:board:{boardId}`), so two
  accounts on the same browser never share a cache. All of a user's databases are deleted on
  sign-out, and a board's database is cleared when the server refuses access to it.
- **Render from cache:** the board is shown as soon as either the local copy (with content) or the
  first server sync is available. Brand-new boards wait for the server, which creates the initial
  document (ADR 0016).
- **Browser connectivity events drive the socket.** `offline` disconnects the provider (the
  WebSocket could otherwise take up to 30 s to time out, and reconnect attempts would keep
  running); `online` reconnects. Edits made offline live in the `Y.Doc` and IndexedDB, and the
  Yjs sync handshake sends them on reconnect.
- **Status:** `online` (connected, synced, nothing pending), `syncing` (initial sync after
  (re)connecting, or local changes unacknowledged for more than 1 s), `offline`, `connecting`
  (first connection only) and `forbidden`. Short acknowledgement gaps are not reported, so the badge
  (an ARIA live region) does not change on every keystroke.
- **Permissions while offline:** the last scope the server granted is kept; before the first
  successful authentication the board is read-only.
- **REST data** keeps TanStack Query's `networkMode: 'offlineFirst'` (already in place); the board
  page only needs the cached workspace list.

## Consequences

- Losing the connection while a board is open loses nothing, including across reloads once back
  online.
- Opening the app from a cold start without a network is not supported: the SPA has no service
  worker yet and the session is restored through the refresh cookie. An installable PWA is listed
  as an extra in the spec.
- Cached boards stay on the device until sign-out; a user removed from a workspace keeps a local
  copy only until they open that board again.
