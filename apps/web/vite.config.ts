import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Use internal packages' TypeScript sources (see docs/decisions/0009).
    conditions: ['@realtime-kanban/source', ...defaultClientConditions],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
