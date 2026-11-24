# 0018. Presence over Yjs awareness

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The spec (4.5) defines each client's awareness state as
`{ user: { id, name, color, avatarUrl }, cursor?: { x, y }, editingCardId?, viewingCardId? }`, with
avatars of who is online, remote cursors throttled to 50 ms and an "editing…" indicator. Awareness
is relayed by the collaboration server as-is, so every field is written by another client.

## Decision

- **Transport:** the Hocuspocus provider's built-in `Awareness`; no server changes.
- **Validation:** remote states are parsed with Zod before they reach the DOM. Colors must be
  `#rrggbb` (they end up in inline styles), avatar URLs must be `http(s)`, names are capped, and
  malformed optional fields become `null`. Invalid states are ignored.
- **Colors:** derived from the user id with a fixed palette, so a user has the same color for
  everyone without storing it.
- **Avatars:** one per user, even with several tabs open; the current user is shown first.
- **Pointer cursor:** coordinates relative to the scrollable board content (so they survive
  scrolling), sent with a leading + trailing throttle of 50 ms, cleared on `pointerleave`.
- **Viewing vs. editing:** opening a card sets `viewingCardId`; focus inside one of its fields
  sets `editingCardId`. Cards show "<name> is editing…" in the editor's color.
- **Rich text carets** use a separate awareness field, `caret` (ADR 0021), so the board's `cursor`
  keeps the shape the spec defines.
- **Rendering:** components select only what they need from awareness and re-render only when
  that selection changes (compared as JSON), so pointer moves do not re-render the board.

## Consequences

- Presence costs no storage and disappears when a client disconnects (awareness timeout).
- A hostile client can still pick any display name or color within those limits; identity comes
  from the authenticated connection, not from awareness, and nothing security-relevant reads it.
