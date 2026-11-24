# realtime-kanban

> A local-first, real-time collaborative Kanban board. Edit together, keep working offline, converge without conflicts.

[![CI](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml/badge.svg)](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 🚧 **Work in progress.** Phases 0–3 (foundation, auth and workspaces, collaborative board, presence/offline/undo) are done. See the [roadmap](#roadmap).

<!-- TODO(phase 5): GIF of two windows syncing side by side. -->

## Live demo

_Coming in Phase 5._ Demo accounts will be `alice@demo.dev` / `bob@demo.dev` (password `password`).

## Features

- **Real-time collaboration** through CRDTs (Yjs): columns and cards edited by several people at
  once, with conflict-free ordering (fractional indexing) and keyboard-accessible drag and drop.
- **Offline-first:** each board is cached in IndexedDB; keep working without a connection and your
  changes sync on reconnect. A status badge shows Online / Offline / Syncing.
- **Presence:** avatars of who is on the board, live cursors with names and an "editing…" marker
  on the card someone is working on.
- **Per-user undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) that never reverts someone else's change.
- **Collaborative card descriptions:** a rich text editor (TipTap) with everyone's carets.
- Workspaces with roles (owner, admin, member, viewer), e-mail invitations and read-only viewers.

_Planned:_ labels, assignees, due dates, checklists, search and filters, version history (phase 4)
and a horizontally scalable collaboration server (phase 5).

## How it works

Each board is a [Yjs](https://yjs.dev) document (a CRDT): every client applies changes locally and
exchanges binary updates through the Hocuspocus server, and all replicas converge to the same
state regardless of the order updates arrive in.

Cards are **not** kept in per-column arrays. Moving an item inside a `Y.Array` is a delete plus an
insert, so two people moving the same card at once could duplicate it. Instead every card stores
its `columnId` and a `position` string generated with fractional indexing; a move rewrites just
those two fields in one transaction, and the UI sorts by `position` (ties broken by id). A
property-based test throws random concurrent operations at three replicas and checks that they
end up identical, with no duplicated or lost cards.

The collaboration server authenticates each WebSocket with the same short-lived JWT as the REST
API, checks the user's role in Postgres (viewers connect read-only) and persists the document as a
binary blob with debounced writes.

**Offline-first.** The browser keeps a copy of every open board in IndexedDB (`y-indexeddb`), so a
board opens from the local copy before the server answers. When the network drops, edits keep
going into the local document; on reconnect, the Yjs sync handshake exchanges only what each side is
missing, and the CRDT merges it with what others did meanwhile. Local copies are per user and are
deleted on sign-out.

**Presence** uses Yjs _awareness_, an ephemeral side channel: each client publishes its user, color,
pointer position (at most every 50 ms) and the card it is viewing or editing. Nothing of it is
stored, and remote states are validated before they are rendered.

**Undo/redo is per user.** Every local change is made in a transaction with a tab-specific origin,
and the `Y.UndoManager` tracks only that origin, so `Ctrl+Z` reverts your last action and never a
change that came from someone else. Undoing an old move does not override a newer move made by a
teammate.

_Redis scaling is described when it lands (phase 5)._ All architecture decisions are recorded in
[`docs/decisions/`](docs/decisions/).

## Stack

| Layer         | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                               |
| Web           | React 19, Vite, TypeScript, Tailwind CSS v4               |
| Collaboration | Yjs + Hocuspocus                                          |
| API           | Fastify 5 + Zod                                           |
| Data          | PostgreSQL 18 (Drizzle ORM), Redis 8                      |
| Web data      | TanStack Router + Query, shadcn/ui, i18next               |
| Quality       | ESLint (flat config, typescript-eslint), Prettier, Vitest |
| Infra         | Docker Compose (local), GitHub Actions (CI)               |

## Running locally

**Requirements:** Node.js 22.12+ (see `.nvmrc`), Corepack (ships with Node), Docker with Compose.

```bash
corepack enable                               # provides the pnpm version pinned in package.json
pnpm install
cp apps/api/.env.example apps/api/.env        # dev defaults (DATABASE_URL, JWT_SECRET, SMTP...)
cp apps/collab/.env.example apps/collab/.env  # same JWT_SECRET as the API
cp packages/db/.env.example packages/db/.env  # DATABASE_URL for migrations
pnpm infra:up                                 # Postgres, Redis and Mailpit via Compose
pnpm db:migrate
pnpm db:seed                                  # alice@demo.dev / bob@demo.dev, password "password"
pnpm dev                                      # infra + api, collab and web with hot reload
```

| Service      | URL                          |
| ------------ | ---------------------------- |
| Web          | http://localhost:5173        |
| API          | http://localhost:3000/health |
| API docs     | http://localhost:3000/docs   |
| Collab (WS)  | http://localhost:1234/health |
| Mailpit (UI) | http://localhost:8025        |

Host ports for the infrastructure can be overridden by copying `.env.example` to `.env`.
Each app has its own `.env.example`; copy it to `.env` (`.env.local` for the web app) if you need to change defaults.

Other useful scripts:

```bash
pnpm dev:apps      # apps only, without starting Docker
pnpm lint          # ESLint in every workspace
pnpm typecheck     # tsc in every workspace
pnpm test          # Vitest in every workspace (API integration tests need Docker)
pnpm test:e2e      # Playwright against a running `pnpm dev` (first: pnpm --filter @realtime-kanban/e2e exec playwright install chromium)
                   # two browsers as alice and bob: real-time edits, presence, offline sync, per-user undo
pnpm db:generate   # generate a migration after changing packages/db/src/schema.ts
pnpm build         # production builds
pnpm format        # Prettier
pnpm infra:down    # stop the Compose services
```

## Monorepo structure

```
realtime-kanban/
├── apps/
│   ├── web/       # React SPA
│   ├── api/       # Fastify REST API
│   └── collab/    # Hocuspocus WebSocket server
├── packages/
│   ├── shared/    # Zod schemas, roles/permissions, error codes
│   ├── board-doc/ # Yjs board schema + pure operations (fractional indexing)
│   ├── db/        # Drizzle schema, migrations, Postgres client
│   └── config/    # shared tsconfig, ESLint and Prettier presets
├── e2e/           # Playwright tests
├── docs/decisions # Architecture Decision Records
└── docker-compose.yml
```

## Roadmap

- [x] **Phase 0 — Foundation:** monorepo, shared configs, Docker Compose, CI.
- [x] **Phase 1 — Auth and workspaces (REST):** auth with rotating refresh tokens, workspaces, members, invitations, boards list.
- [x] **Phase 2 — Collaborative board (core):** Yjs document + convergence tests, Hocuspocus with auth and Postgres persistence, board UI with keyboard-accessible drag and drop.
- [x] **Phase 3 — Presence, offline and undo:** avatars, live cursors and "editing…", IndexedDB cache with offline sync and status, per-user undo/redo, collaborative rich text descriptions, E2E in CI.
- [ ] **Phase 4 — Product features.**
- [ ] **Phase 5 — Scale and deploy.**

## License

[MIT](LICENSE)
