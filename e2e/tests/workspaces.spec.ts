import { expect, test } from '@playwright/test';

const uniqueEmail = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@demo.dev`;

test('a new user signs up, creates a workspace and a board', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole('link', { name: 'Create one' }).click();
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('E-mail').fill(uniqueEmail());
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
  await page.getByLabel('Workspace name').fill('E2E Workspace');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(/\/w\/e2e-workspace/);
  await expect(page.getByRole('heading', { name: 'E2E Workspace' })).toBeVisible();

  await page.getByLabel('Board title').fill('Launch plan');
  await page.getByRole('button', { name: 'Create' }).click();
  const boardLink = page.getByRole('link', { name: 'Launch plan' });
  await expect(boardLink).toBeVisible();

  // The session survives a reload through the refresh cookie (access token is memory-only).
  await page.reload();
  await expect(boardLink).toBeVisible();

  await boardLink.click();
  await expect(page).toHaveURL(/\/w\/e2e-workspace[\w-]*\/b\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Launch plan' })).toBeVisible();
});

test('the seeded demo user signs in and sees the demo board', async ({ page }) => {
  await page.goto('/w/demo');
  await expect(page).toHaveURL(/\/login\?redirect=/);

  await page.getByLabel('E-mail').fill('alice@demo.dev');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/w\/demo$/);
  await expect(page.getByRole('link', { name: 'Product launch' })).toBeVisible();
});

test('wrong credentials show an error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(uniqueEmail());
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail or password is incorrect.');
});
