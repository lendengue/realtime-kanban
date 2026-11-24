# 0022. Token renewal on live connections and end-to-end tests in CI

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The access token is checked when a WebSocket document connection is authenticated (ADR 0016), but
a board can stay open for hours while the 15-minute token is refreshed by the REST client. Phase 2
also left the Playwright suite out of CI.

## Decision

- **The client sends every renewed access token on the open connection.** The collaboration
  server's `onTokenSync` verifies it: an invalid token or one for another user closes the document
  connection (`invalid-token`), a user no longer in the workspace is disconnected (`forbidden`),
  and a changed role closes it with `permissions-changed`.
- **After the server closes a document, the client authenticates it again on the same socket**
  (sending the token and restarting the sync). Hocuspocus treats that as a fresh connection, so a
  changed role arrives as the new scope and a refusal goes through the normal auth-failure path
  (one session refresh, then "no access").
- Connections are not closed when the token merely expires; access is re-checked on every renewal
  and on every reconnect.
- **CI job `e2e`:** brings up the Compose infrastructure, migrates and seeds, starts api, collab and
  web in dev mode, waits for their health endpoints and runs Playwright (retries: 2). On failure it
  uploads the HTML report, traces, videos and app logs as an artifact.
- **Login rate limit is configurable** (`LOGIN_RATE_LIMIT_PER_MINUTE`, default 5 as in the spec).
  Only the CI E2E job raises it, because retried tests sign the same demo users in again.

## Consequences

- A removed member loses access at the latest on their next token refresh (≤ 15 minutes) instead
  of when they close the tab.
- The E2E job adds a few minutes to CI and depends on Docker on the runner (available on
  `ubuntu-latest`).
