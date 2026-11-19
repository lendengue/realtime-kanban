# 0006. Infra in Docker Compose, apps on the host

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The spec asks for `pnpm dev` with hot reload through Turborepo and infrastructure through Compose,
but does not fix image versions, ports or whether the apps also run in containers during Phase 0.

## Decision

- `docker-compose.yml` runs only infrastructure: `postgres:18.7-alpine`, `redis:8.8.4-alpine` and
  `axllent/mailpit:v1.34.0`, each with a healthcheck. `pnpm dev` runs
  `docker compose up -d --wait` and then `turbo run dev`; `pnpm dev:apps` skips Docker.
- Containerised `api`, `collab`, `web`, the `scale` profile and Caddy arrive in Phase 5, together
  with the Dockerfiles needed for GHCR images.
- Host ports are overridable through a root `.env` (`POSTGRES_PORT`, `REDIS_PORT`,
  `MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT`). Dev-only credentials default to `realtime_kanban/realtime_kanban`.
- Versions are the latest stable at creation time (spec minimums: Postgres 17+, Redis 7+).
  Redis 8 is distributed under RSALv2 / SSPLv1 / **AGPLv3**; we only use the unmodified image as a
  backing service, which is compatible with the project's MIT license. Valkey (BSD) is a drop-in
  alternative if this becomes a concern.

## Consequences

- Fast hot reload and debugging on the host; Docker only for stateful services.
- Postgres 18 images store data under `/var/lib/postgresql/<major>`, so the volume mounts
  `/var/lib/postgresql`.
