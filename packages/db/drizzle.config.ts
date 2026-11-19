import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgres://realtime_kanban:realtime_kanban@localhost:5432/realtime_kanban',
  },
  strict: true,
  verbose: true,
});
