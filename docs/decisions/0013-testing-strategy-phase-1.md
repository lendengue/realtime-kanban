# 0013. API integration and early end-to-end tests

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The spec requires API integration tests with a real Postgres through Testcontainers, and
Playwright E2E tests (scheduled for phase 3).

## Decision

- **API:** a Vitest `globalSetup` starts one `postgres:18.7-alpine` container per run and applies
  the migrations. Test files run sequentially, each builds its own Fastify instance (via `inject`,
  no network), and every test starts from truncated tables. Mail goes to an in-memory mailer.
- **E2E:** the `e2e/` workspace (Playwright) is created now with smoke tests for sign-up,
  workspace and board creation and the seeded demo login. It runs against an already running
  stack (`pnpm dev`, then `pnpm test:e2e`) and is not part of `pnpm test`; the CI job that boots
  the stack arrives with the two-browser E2E test in phase 3.
- Vitest resolves internal packages from source (ADR 0009) so tests never run against stale builds.

## Consequences

- Integration tests need Docker locally and in CI (available on GitHub-hosted Ubuntu runners).
