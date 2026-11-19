import { expect, test, type Page } from '@playwright/test';

// Note: login is rate limited to 5 attempts/min per IP and e-mail; rerunning this suite many times
// within a minute will fail with "Too many attempts".
async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
}

const column = (page: Page, title: string) =>
  page.getByRole('region', { name: title, exact: true });
const card = (page: Page, columnTitle: string, title: string) =>
  column(page, columnTitle).getByTestId('card').filter({ hasText: title });

test('two users edit the same board in real time', async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  // Alice creates a fresh board in the seeded demo workspace (Bob is a member).
  await signIn(alice, 'alice@demo.dev');
  await alice.goto('/w/demo');
  const boardTitle = `Realtime ${Date.now()}`;
  await alice.getByLabel('Board title').fill(boardTitle);
  await alice.getByRole('button', { name: 'Create' }).click();
  await alice.getByRole('link', { name: boardTitle }).click();
  await expect(alice.getByTestId('connection-status')).toHaveText('Online');
  await expect(alice.getByTestId('column')).toHaveCount(3);

  await signIn(bob, 'bob@demo.dev');
  await bob.goto(alice.url());
  await expect(bob.getByTestId('connection-status')).toHaveText('Online');
  await expect(bob.getByRole('heading', { name: boardTitle })).toBeVisible();

  // Alice creates a card; Bob sees it without reloading.
  await alice.getByLabel('Add a card to To do').fill('Hello from Alice');
  await alice.getByLabel('Add a card to To do').press('Enter');
  await expect(card(bob, 'To do', 'Hello from Alice')).toBeVisible();

  // Bob moves it to "In progress" with the keyboard only; Alice sees the move.
  const handle = card(bob, 'To do', 'Hello from Alice').getByRole('button', {
    name: 'Hello from Alice',
    exact: true,
  });
  // Each step waits for dnd-kit's screen-reader announcement, like an assistive-tech user would.
  const announcer = bob.locator('[id^="DndLiveRegion"]');
  await handle.focus();
  await bob.keyboard.press('Space');
  await expect(announcer).toContainText('Hello from Alice is over');
  await bob.keyboard.press('ArrowRight');
  await expect(announcer).toContainText('is over In progress');
  await bob.keyboard.press('Space');
  await expect(announcer).toContainText('was dropped on In progress');
  await expect(card(alice, 'In progress', 'Hello from Alice')).toBeVisible();
  await expect(card(alice, 'To do', 'Hello from Alice')).toHaveCount(0);

  // Alice drags it with the mouse to "Done"; Bob sees the move.
  const aliceCard = card(alice, 'In progress', 'Hello from Alice');
  const source = await aliceCard.boundingBox();
  const target = await column(alice, 'Done').boundingBox();
  if (!source || !target) throw new Error('missing layout boxes');
  await alice.mouse.move(source.x + 20, source.y + 15);
  await alice.mouse.down();
  await alice.mouse.move(source.x + 40, source.y + 30, { steps: 5 });
  await alice.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 15 });
  await alice.mouse.up();
  await expect(card(bob, 'Done', 'Hello from Alice')).toBeVisible();
  await expect(card(bob, 'In progress', 'Hello from Alice')).toHaveCount(0);

  // Bob adds a column; Alice sees it.
  await bob.getByLabel('Add a column').fill('Review');
  await bob.getByRole('button', { name: 'Create' }).click();
  await expect(column(alice, 'Review')).toBeVisible();

  // Edits survive a reload (persisted by the collab server).
  await alice.reload();
  await expect(card(alice, 'Done', 'Hello from Alice')).toBeVisible();
  await expect(column(alice, 'Review')).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});
