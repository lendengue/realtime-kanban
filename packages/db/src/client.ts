import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDatabase(
  connectionString: string,
  options: pg.PoolConfig = {},
): DatabaseConnection {
  const pool = new pg.Pool({ connectionString, ...options });
  const db = drizzle(pool, { schema });
  return { db, pool, close: () => pool.end() };
}
