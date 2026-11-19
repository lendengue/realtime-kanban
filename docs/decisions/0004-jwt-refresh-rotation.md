# 0004. Short-lived JWTs with rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

Both the REST API and the WebSocket server must authenticate the same user cheaply, and stolen
tokens must have limited value.

## Decision

- Access token: JWT valid for 15 minutes, kept **in memory** on the client and sent as a bearer
  token to the API and as the Hocuspocus `token` parameter.
- Refresh token: opaque random value in an `httpOnly`, `Secure`, `SameSite=Lax` cookie scoped to
  `path=/auth`. Only its hash is stored (`refresh_tokens`).
- Every refresh rotates the token within a `family_id`. Reusing a revoked token revokes the whole
  family (theft detection).
- Passwords are hashed with `argon2`.

## Consequences

- The collab server validates tokens without a database round-trip for identity (it still checks
  membership and role).
- The client must refresh before expiry and reconnect or update the WebSocket provider afterwards.
