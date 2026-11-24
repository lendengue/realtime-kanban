import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against an already running stack (`pnpm dev` locally). Set E2E_BASE_URL to target
 * another environment.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Most tests drive two browsers against the dev servers; more workers saturate the machine and
  // turn into timeouts rather than finding bugs.
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
