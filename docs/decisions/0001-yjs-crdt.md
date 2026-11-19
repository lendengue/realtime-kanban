# 0001. Use Yjs CRDTs for board state

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

realtime-kanban must let several people edit the same board at once, keep working offline and converge
without anyone silently overwriting someone else's change. Server-authoritative last-write-wins
or operational transformation would need a central sequencer and break down offline.

## Decision

Model each board as one Yjs `Y.Doc` (a CRDT). Clients exchange binary updates; any set of updates
applied in any order yields the same state. The schema and all mutations live in
`packages/board-doc` as pure functions wrapped in `doc.transact(fn, origin)`.

## Consequences

- Convergence is guaranteed by the data structure and is verified by automated convergence and
  property-based tests.
- Offline support comes almost for free (`y-indexeddb` + sync on reconnect).
- Relational data (users, workspaces, permissions) stays in Postgres; the board content is an
  opaque binary blob there, so server-side queries over cards need extra work.
