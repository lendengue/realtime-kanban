# 0003. Use Hocuspocus as the collaboration server

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

Yjs needs a server to relay updates, authenticate connections, persist documents and fan out
across instances. Writing that on raw `y-websocket` means re-implementing auth hooks,
debounced persistence and multi-instance sync.

## Decision

Run `@hocuspocus/server` in `apps/collab`, using `onAuthenticate` for JWT and role checks, the
`Database` extension for persistence in Postgres (`board_documents`) and the `Redis` extension
for pub/sub between replicas. Clients connect with `@hocuspocus/provider`.

## Consequences

- Auth, persistence, debouncing and horizontal scaling are configuration, not custom protocol code.
- We follow Hocuspocus' hook model and release cadence (currently v4, built on `crossws`).
- Plain HTTP endpoints (e.g. `/health`) are served through its `onRequest` hook.
