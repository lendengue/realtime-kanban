# @realtime-kanban/config

Shared configuration for every workspace in the monorepo.

| Export                                        | Purpose                                              |
| --------------------------------------------- | ---------------------------------------------------- |
| `@realtime-kanban/config/tsconfig/base.json`  | Strict TypeScript base (`noUncheckedIndexedAccess`). |
| `@realtime-kanban/config/tsconfig/node.json`  | Node.js packages (NodeNext modules).                 |
| `@realtime-kanban/config/tsconfig/react.json` | React + Vite apps (bundler resolution, DOM libs).    |
| `@realtime-kanban/config/eslint/base`         | Type-aware ESLint flat config (`base()`).            |
| `@realtime-kanban/config/eslint/react`        | Base + React hooks / fast-refresh (`react()`).       |
| `@realtime-kanban/config/prettier`            | Prettier options.                                    |
