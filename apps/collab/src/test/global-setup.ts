import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { runMigrations } from '@realtime-kanban/db';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

let container: StartedPostgreSqlContainer | undefined;

/** Starts one disposable Postgres (same major as docker-compose) and applies migrations. */
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('postgres:18.7-alpine').start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  project.provide('databaseUrl', url);
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
