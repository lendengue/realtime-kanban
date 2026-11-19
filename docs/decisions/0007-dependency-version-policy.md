# 0007. Dependency version and supply-chain policy

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The project uses the latest stable version of each dependency and checks licenses before adding
one. pnpm 12 (pinned through `packageManager` and Corepack) enforces a default
`minimumReleaseAge` of one day and blocks dependency install scripts unless allowed.

## Decision

- Add the **latest stable version that passes pnpm's `minimumReleaseAge`**. A release younger than
  a day is skipped instead of being whitelisted (e.g. `turbo` 2.11.12 instead of 2.11.13, published
  hours before setup). The lockfile is committed and CI installs with `--frozen-lockfile`.
- Versions are saved exactly (pnpm default); upgrades are deliberate commits.
- Only MIT/ISC/BSD/Apache-2.0-style licenses are accepted without discussion; anything else needs
  an ADR.
- Install scripts are allowed per package in `pnpm-workspace.yaml` (`allowBuilds`); currently only
  `esbuild`.
- `@types/node` follows the **minimum supported runtime** (Node 22), not the latest major, so we
  cannot accidentally use APIs that Node 22 lacks.
- Internal packages use the `@realtime-kanban/*` scope and `workspace:*` ranges.

## Consequences

- One-day delay on brand-new releases, in exchange for protection against hijacked releases that
  are usually pulled within hours.
