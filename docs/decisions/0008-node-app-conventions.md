# 0008. Conventions for the Node.js apps

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

`apps/api` and `apps/collab` need a consistent way to run in development, build for production,
read configuration and expose health checks. The spec leaves these details open.

## Decision

- **Modules:** ESM only (`"type": "module"`), `module`/`moduleResolution: NodeNext`.
- **Dev:** `tsx watch --env-file-if-exists=.env src/server.ts`. **Build:** `tsc` to `dist/`.
  **Start:** `node --env-file-if-exists=.env dist/server.js`. No extra dotenv dependency.
- **Config:** environment variables are validated once at startup with a Zod schema (`src/env.ts`)
  that provides development defaults; invalid config fails fast with a readable error.
- **Structure:** a factory (`buildApp` / `createCollabServer`) separate from the entrypoint
  (`server.ts`), so tests can start an instance in-process on a random port.
- **Ports:** web `5173`, api `3000`, collab `1234`.
- **Health:** `GET /health` at the root of each server (outside `/api/v1`) returning
  `{ status: 'ok', service }`, for load balancers and orchestrators.
- **Logging:** pino (Fastify's built-in logger in the API, a standalone pino logger in collab).
- **Shutdown:** entrypoints handle `SIGINT`/`SIGTERM` themselves (Hocuspocus `stopOnSignals` is
  disabled) so later phases can flush documents before exiting.

## Consequences

- Both services look and behave alike, which keeps Dockerfiles and CI uniform later.
- Shared code consumed by these apps (Phase 1+) must either be built before them or exported as
  compiled JS; this is decided when the first shared package lands.
