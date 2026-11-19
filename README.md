# realtime-kanban

> A local-first, real-time collaborative Kanban board. Edit together, keep working offline, converge without conflicts.

[![CI](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml/badge.svg)](https://github.com/lendengue/realtime-kanban/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> 🚧 **Work in progress.** Phases 0–1 (foundation, auth and workspaces) are done. See the [roadmap](#roadmap).

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
| Web data      | TanStack Router + Query, shadcn/ui, i18next               |
| Quality       | ESLint (flat config, typescript-eslint), Prettier, Vitest |
| Infra         | Docker Compose (local), GitHub Actions (CI)               |

## Running locally

**Requirements:** Node.js 22.12+ (see `.nvmrc`), Corepack (ships with Node), Docker with Compose.

```bash
corepack enable                               # provides the pnpm version pinned in package.json
pnpm install
cp apps/api/.env.example apps/api/.env        # dev defaults (DATABASE_URL, JWT_SECRET, SMTP...)
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
│   ├── db/        # Drizzle schema, migrations, Postgres client
│   └── config/    # shared tsconfig, ESLint and Prettier presets
├── e2e/           # Playwright tests
├── docs/decisions # Architecture Decision Records
└── docker-compose.yml
```

`packages/board-doc` arrives with the collaborative board (phase 2).

## Roadmap

- [x] **Phase 0 — Foundation:** monorepo, shared configs, Docker Compose, CI.
- [x] **Phase 1 — Auth and workspaces (REST):** auth with rotating refresh tokens, workspaces, members, invitations, boards list.
- [ ] **Phase 2 — Collaborative board (core).**
- [ ] **Phase 3 — Presence, offline and undo.**
- [ ] **Phase 4 — Product features.**
- [ ] **Phase 5 — Scale and deploy.**

## License

[MIT](LICENSE)
