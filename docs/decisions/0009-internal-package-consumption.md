# 0009. Consume internal packages from source in dev, from `dist` in production

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

`apps/api`, `apps/collab` and `apps/web` import internal packages (`@realtime-kanban/shared`,
`@realtime-kanban/db`, later `@realtime-kanban/board-doc`). In development we want edits to a package to hot-reload
in every app without a separate watch build. In production, `node dist/server.js` cannot import
TypeScript sources.

## Decision

Each internal package is compiled with `tsc` to `dist/` and exposes a custom export condition:

```json
"exports": {
  ".": {
    "@realtime-kanban/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

- TypeScript (`typecheck`, editor, type-aware ESLint) resolves `@realtime-kanban/source` through
  `customConditions` in the shared base tsconfig. Build configs reset it to `[]` so `tsc` emits
  only the package's own files.
- `tsx` (dev) runs with `--conditions=@realtime-kanban/source`; Vite and Vitest add it to `resolve.conditions`.
- Production (`node dist/...`) uses the `default` condition, i.e. compiled JS. Turborepo's
  `^build` dependency guarantees packages are built first.

## Consequences

- No watch builds for packages during development; types and code are always in sync.
- Relative imports inside packages need explicit `.js` extensions (NodeNext), since the compiled
  output is consumed by plain Node.js.
