# 0005. Pin TypeScript 6.0 instead of 7.0

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The project rule is to use the latest stable version of each dependency. The latest stable
TypeScript is 7.0 (the native Go port). The latest stable `typescript-eslint` (8.x), required for
type-aware linting, declares `typescript: >=4.8.4 <6.1.0`; its TypeScript 7 support only targets
7.1 pre-releases.

## Decision

Use TypeScript **6.0.x**, the newest release supported by the stable `typescript-eslint`.

## Consequences

- Type-aware linting works with fully supported versions.
- We miss TS 7's faster compiler for now. Revisit when a stable `typescript-eslint` supports TS 7.
- TS 6 defaults `types` to `[]`, so every tsconfig lists its ambient types explicitly
  (`node`, `vite/client`).
