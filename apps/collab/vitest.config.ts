import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['@realtime-kanban/source'] },
  ssr: { resolve: { conditions: ['@realtime-kanban/source'] } },
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // Test files share one Postgres container and reset it between tests.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
