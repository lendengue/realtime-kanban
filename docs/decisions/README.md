# Architecture Decision Records

Short records of decisions that shape the project. Copy [`template.md`](template.md) to add one,
using the next free number. Never rewrite an accepted ADR; supersede it with a new one.

| #                                               | Title                                                        | Status   |
| ----------------------------------------------- | ------------------------------------------------------------ | -------- |
| [0001](0001-yjs-crdt.md)                        | Use Yjs CRDTs for board state                                | Accepted |
| [0002](0002-fractional-indexing-over-yarray.md) | Order cards with fractional indexing, not `Y.Array`          | Accepted |
| [0003](0003-hocuspocus-server.md)               | Use Hocuspocus as the collaboration server                   | Accepted |
| [0004](0004-jwt-refresh-rotation.md)            | Short-lived JWTs with rotating refresh tokens                | Accepted |
| [0005](0005-typescript-6.md)                    | Pin TypeScript 6.0 instead of 7.0                            | Accepted |
| [0006](0006-local-dev-environment.md)           | Infra in Docker Compose, apps on the host                    | Accepted |
| [0007](0007-dependency-version-policy.md)       | Dependency version and supply-chain policy                   | Accepted |
| [0008](0008-node-app-conventions.md)            | Conventions for the Node.js apps                             | Accepted |
| [0009](0009-internal-package-consumption.md)    | Consume internal packages from source in dev, `dist` in prod | Accepted |
