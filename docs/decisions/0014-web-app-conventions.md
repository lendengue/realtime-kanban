# 0014. Web app conventions

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The spec picks React, TanStack Router/Query, Tailwind v4 and shadcn/ui, and asks for an English UI
with i18n prepared. How routes are declared and how strings are managed was left open.

## Decision

- **Routing:** TanStack Router with a code-based route tree (`src/router.ts`), no file-based
  generator or generated files. Pathless layout routes guard auth (`authed`) and redirect signed-in
  users away from sign-in pages (`auth`). Post-login redirects only accept same-app paths.
- **Data:** TanStack Query with `networkMode: 'offlineFirst'` for queries and mutations; 4xx errors
  are not retried. Responses are validated with the shared Zod schemas.
- **Workspace URLs** use the slug (`/w/:workspaceSlug`); the workspace is resolved from the cached
  workspace list, so no extra "get by slug" endpoint is needed.
- **UI kit:** shadcn/ui (`new-york` style, Radix primitives, CSS variables) generated into
  `src/components/ui`; these files are treated as vendored code.
- **i18n:** `i18next` + `react-i18next` with typed keys from `src/i18n/en.ts`. Every UI string goes
  through `t()`. Error messages map API error codes to translations and fall back to the server
  message. Adding pt-BR means adding a resource bundle and a language switcher.

## Consequences

- Route definitions are explicit and type-checked without a code generator.
- Translations are type-safe: a missing key fails `typecheck`.
