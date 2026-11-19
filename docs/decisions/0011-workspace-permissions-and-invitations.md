# 0011. Workspace permission and invitation rules

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The spec's permission table covers boards, members and workspace deletion, but not renaming a
workspace, ownership, leaving, or the details of invitations.

## Decision

- Permissions are defined once in `@realtime-kanban/shared` (`can(role, permission)`) and reused by the API
  and the web app.
- **Rename workspace:** owner and admin.
- **Non-members** get `404` for a workspace or board (its existence is not disclosed); members
  without permission get `403`.
- **Ownership** is not transferable for now: `owner` cannot be assigned, changed or removed.
  Admins can change any non-owner role, including other admins.
- **Leaving:** any non-owner member can remove themselves.
- **Invitations:** owner/admin only; roles `admin`, `member` or `viewer`; valid for 7 days
  (`INVITATION_TTL_DAYS`); single use; only the hash of the token is stored. The accepting
  account's e-mail must match the invited address (case-insensitive) — the link alone is not
  enough. Inviting an existing member returns `409 ALREADY_MEMBER`.
- **Delivery:** SMTP through `nodemailer` (MIT-0), pointing at Mailpit in development. Outside
  production the accept link is also logged. Tests use an in-memory mailer. A Resend adapter can
  implement the same `Mailer` interface later.
- **Slugs:** derived from the name; on collision a 6-hex-character suffix is appended.

## Consequences

- Clear, testable rules (covered by the API integration tests).
- Ownership transfer and invitation revocation/listing are future work.
