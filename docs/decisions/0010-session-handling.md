# 0010. Session handling details

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

ADR 0004 fixes the model (15-minute JWT in memory, rotating refresh token in an httpOnly cookie
with reuse detection). Several details were left open by the spec.

## Decision

- **Signing:** HS256 through `jose` (MIT), with a shared `JWT_SECRET` (≥ 32 chars) used by the API
  and, from phase 2, the collab server. Claims: `sub`, `iss=realtime-kanban`, `aud=realtime-kanban`, `iat`, `exp`.
  EdDSA would only pay off if a third party had to verify tokens.
- **Refresh token:** 256-bit random value (base64url); only its SHA-256 hash is stored. Each
  rotation creates a new row in the same `family_id` and extends the expiry (sliding, 30 days).
  A token is revoked with a conditional `UPDATE ... WHERE revoked_at IS NULL`, so two concurrent
  uses of the same token count as reuse.
- **Cookie:** `realtime_kanban_rt`, `httpOnly`, `SameSite=Lax`, `Secure` (browsers accept it on
  `http://localhost`; `COOKIE_SECURE=false` exists for tests), `path=/api/v1/auth`. The spec says
  `path=/auth`, but the API lives under `/api/v1`, so the path must include the prefix.
- **Logout** revokes the whole family of the presented token (that device's session only).
- **Login rate limit:** `@fastify/rate-limit` on the login route, 5/min, keyed by IP + normalised
  e-mail, evaluated in `preHandler` so the parsed body is available.
- **Client:** the access token lives in a small in-memory store; on page load the session is
  restored by calling `/auth/refresh`. Refreshes are de-duplicated within a tab and serialised
  across tabs with the Web Locks API — without this, two tabs refreshing with the same cookie
  would trigger reuse detection and sign the user out. API calls retry once after a refresh on 401.
- **CORS:** a single allowed origin (`WEB_ORIGIN`) with credentials. Because the cookie is `Lax`,
  production must serve web and API from the same site (e.g. `app.example.com` and
  `api.example.com`).

## Consequences

- Stolen refresh tokens are detected on first reuse; access tokens stay valid until they expire
  (≤ 15 min), the accepted trade-off of stateless JWTs.
- Cross-site deployments (web and API on unrelated domains) would need `SameSite=None` and CSRF
  protection; see phase 5.
