# 0016. Collaboration server: authentication and persistence

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

Spec section 7 describes `onAuthenticate` and the `Database` extension. Some details were open:
token verification code, archived boards, and boards without a stored document.

## Decision

- **Token verification** reuses `AccessTokenService`, moved to the `@realtime-kanban/shared/access-token`
  subpath so the API (signing) and collab (verifying) share one implementation, while the web
  bundle, which imports the main entry, never pulls in `jose`.
- **`onAuthenticate`** rejects malformed document names, invalid/expired tokens and non-members
  (all reported to the client as authentication failures), and sets `connectionConfig.readOnly`
  for viewers **and for everyone on archived boards** (archived boards are frozen).
- **Initial document:** the API creates the board row and its initial Y.Doc state (default
  columns) in one transaction. For boards that have no document (created before this phase),
  the collab server creates it on first load with `INSERT ... ON CONFLICT DO NOTHING` followed
  by a re-read, so concurrent first loads on several instances agree on one document.
- **Persistence:** `fetch` reads `board_documents.state`; `store` upserts the full state and
  mirrors the board title into `boards.title` (only when non-empty) and `updated_at`, with
  Hocuspocus' `debounce: 2000` / `maxDebounce: 10000` (configurable).
- **Shutdown:** the entrypoint calls `server.destroy()`, which stores every loaded document
  before exiting.

## Consequences

- Integration tests run two real `HocuspocusProvider` clients (Node's global `WebSocket`) against
  a server backed by Testcontainers Postgres.
- Token expiry during a long-lived connection is handled by the client (refresh + resend); the
  server-side `onTokenSync` hook is left for phase 3.
