# realtime-kanban

> A local-first, real-time collaborative Kanban board. Edit together, keep working offline, converge without conflicts.

[![CI](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml/badge.svg)](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 🚧 **Work in progress.** Phase 0 (foundation) is done. See the [roadmap](#roadmap).

<!-- TODO(phase 5): GIF of two windows syncing side by side. -->

## Live demo

_Coming in Phase 5._ Demo accounts will be `alice@demo.dev` / `bob@demo.dev` (password `password`).

## Features

_Planned:_ real-time collaboration through CRDTs (Yjs), offline-first editing with IndexedDB,
live presence and cursors, per-user undo/redo, conflict-free card ordering with fractional indexing,
and a horizontally scalable collaboration server.

## How it works

_To be written as the core lands (Phases 2–5)._ Architecture decisions are recorded in
[`docs/decisions/`](docs/decisions/).

## Stack

| Layer         | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                               |
| Web           | React 19, Vite, TypeScript, Tailwind CSS v4               |
| Collaboration | Yjs + Hocuspocus                                          |
| API           | Fastify 5 + Zod                                           |
| Data          | PostgreSQL 18 (Drizzle ORM), Redis 8                      |
| Quality       | ESLint (flat config, typescript-eslint), Prettier, Vitest |
| Infra         | Docker Compose (local), GitHub Actions (CI)               |

## Running locally

**Requirements:** Node.js 22.12+ (see `.nvmrc`), Corepack (ships with Node), Docker with Compose.

```bash
corepack enable          # provides the pnpm version pinned in package.json
pnpm install
pnpm dev                 # starts Postgres, Redis and Mailpit via Compose, then all apps
```

| Service      | URL                          |
| ------------ | ---------------------------- |
| Web          | http://localhost:5173        |
| API          | http://localhost:3000/health |
| Collab (WS)  | http://localhost:1234/health |
| Mailpit (UI) | http://localhost:8025        |

Host ports for the infrastructure can be overridden by copying `.env.example` to `.env`.
Each app has its own `.env.example`; copy it to `.env` (`.env.local` for the web app) if you need to change defaults.

Other useful scripts:

```bash
pnpm dev:apps      # apps only, without starting Docker
pnpm lint          # ESLint in every workspace
pnpm typecheck     # tsc in every workspace
pnpm test          # Vitest in every workspace
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
│   └── config/    # shared tsconfig, ESLint and Prettier presets
├── docs/decisions # Architecture Decision Records
└── docker-compose.yml
```

`packages/shared`, `packages/board-doc`, `packages/db` and `e2e/` arrive with the phases that need them.

## Roadmap

- [x] **Phase 0 — Foundation:** monorepo, shared configs, Docker Compose, CI.
- [ ] **Phase 1 — Auth and workspaces (REST).**
- [ ] **Phase 2 — Collaborative board (core).**
- [ ] **Phase 3 — Presence, offline and undo.**
- [ ] **Phase 4 — Product features.**
- [ ] **Phase 5 — Scale and deploy.**

## License

[MIT](LICENSE)
