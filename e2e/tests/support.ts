import { expect, type Browser, type Page } from '@playwright/test';

// Note: login is rate limited to 5 attempts/min per IP and e-mail; rerunning the suites many times
// within a minute fails with "Too many attempts" unless the API runs with a higher
// LOGIN_RATE_LIMIT_PER_MINUTE (as in CI).
export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
}

export const column = (page: Page, title: string) =>
  page.getByRole('region', { name: title, exact: true });

export const card = (page: Page, columnTitle: string, title: string) =>
  column(page, columnTitle).getByTestId('card').filter({ hasText: title });

/** The card's title, which opens it (click/Enter) and is its drag handle (Space). */
export const cardHandle = (page: Page, columnTitle: string, title: string) =>
  card(page, columnTitle, title).getByRole('button', { name: title, exact: true });

export const status = (page: Page) => page.getByTestId('connection-status');

export async function addCard(page: Page, columnTitle: string, title: string) {
  const input = page.getByLabel(`Add a card to ${columnTitle}`);
  await input.fill(title);
  await input.press('Enter');
}

/**
 * Alice (owner) and Bob (member of the seeded demo workspace) in two isolated browser contexts,
 * both on a fresh board created by Alice.
 */
export async function openSharedBoard(browser: Browser, prefix: string) {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await signIn(alice, 'alice@demo.dev');
  await alice.goto('/w/demo');
  const boardTitle = `${prefix} ${Date.now()}`;
  await alice.getByLabel('Board title').fill(boardTitle);
  await alice.getByRole('button', { name: 'Create' }).click();
  await alice.getByRole('link', { name: boardTitle }).click();
  await expect(status(alice)).toHaveText('Online');
  await expect(alice.getByTestId('column')).toHaveCount(3);

  await signIn(bob, 'bob@demo.dev');
  await bob.goto(alice.url());
  await expect(status(bob)).toHaveText('Online');
  await expect(bob.getByRole('heading', { name: boardTitle })).toBeVisible();

  return {
    alice,
    bob,
    aliceContext,
    bobContext,
    boardTitle,
    close: async () => {
      await aliceContext.close();
      await bobContext.close();
    },
  };
}
