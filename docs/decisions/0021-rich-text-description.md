# 0021. Card descriptions as `Y.XmlFragment`

- **Status:** Accepted
- **Date:** 2026-11-24

## Context

The spec (4.3, 6.5) stores the card description as `Y.Text` and asks for TipTap with
`@tiptap/extension-collaboration` and collaborative cursors. TipTap's Yjs binding (`y-tiptap`, a
fork of `y-prosemirror`) only binds to a `Y.XmlFragment`: a ProseMirror document is a tree of
nodes, not a flat string. Both requirements cannot hold at once.

## Decision

- **Descriptions are `Y.XmlFragment`s.** New cards get an empty fragment; `readCard` projects it to
  plain text (block elements separated by new lines) for previews and the upcoming search.
- **Upgrade path:** `upgradeBoard(doc)` converts legacy `Y.Text` descriptions into paragraphs. The
  collaboration server runs it in `afterLoadDocument`, so a single writer migrates each document
  instead of every client racing to replace the same field. It is idempotent.
- **Editor:** StarterKit (with its own history disabled in favour of the Yjs one), Collaboration
  bound to the card's fragment, and a placeholder. The editor is lazy-loaded; it is a third of the
  bundle.
- **Remote carets:** TipTap's caret extension cannot be used. It writes the selection to the
  awareness field `cursor`, which the board uses for the pointer (ADR 0018), and `y-tiptap` reads
  `cursor` when drawing remote carets even if another field is configured. We use `yCursorPlugin`
  directly through a small adapter that exposes our `caret` field as `cursor`, and only for peers
  viewing the same card, whose relative positions point into this fragment. Caret labels are
  built with text nodes and validated colors and hidden from assistive technology.

## Consequences

- Descriptions support basic formatting (bold, italic, lists, headings) for free.
- The adapter relies on the members of `Awareness` that the plugin uses (`getStates`,
  `getLocalState`, `setLocalStateField`, `on`/`off`). An upgrade of `@tiptap/y-tiptap` must be
  checked against it; the end-to-end test asserts remote carets.
