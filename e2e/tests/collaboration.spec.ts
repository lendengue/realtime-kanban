import { expect, test, type Page } from '@playwright/test';

import { addCard, card, cardHandle, openSharedBoard, status } from './support.js';

const cardDialog = (page: Page) => page.getByTestId('card-dialog');
const description = (page: Page) => cardDialog(page).getByRole('textbox', { name: 'Description' });

/** Description text without the remote carets' name labels. */
const descriptionText = (page: Page) =>
  description(page).evaluate((element) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.collaboration-caret').forEach((caret) => caret.remove());
    return copy.textContent;
  });

/** Moves focus out of any text field, so Ctrl+Z reaches the board instead of the input. */
const blur = (page: Page) =>
  page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });

const offlineDatabases = (page: Page) =>
  page.evaluate(async () =>
    (await indexedDB.databases())
      .map((database) => database.name ?? '')
      .filter((name) => name.startsWith('realtime-kanban:')),
  );

test('presence, live cursors and the collaborative description', async ({ browser }) => {
  const { alice, bob, close } = await openSharedBoard(browser, 'Presence');

  // Avatars of who is online.
  await expect(
    alice.getByTestId('presence-avatar').getByRole('img', { name: 'Bob' }),
  ).toBeVisible();
  await expect(
    bob.getByTestId('presence-avatar').getByRole('img', { name: 'Alice' }),
  ).toBeVisible();

  // Bob's pointer over the board shows up, with his name, on Alice's screen.
  const canvas = await bob.getByTestId('board-canvas').boundingBox();
  if (!canvas) throw new Error('missing board canvas');
  await bob.mouse.move(canvas.x + 200, canvas.y + 150, { steps: 5 });
  await expect(alice.getByTestId('remote-cursor').filter({ hasText: 'Bob' })).toBeVisible();

  // Alice opens a card and edits its description: Bob sees "editing…" on the card.
  await addCard(alice, 'To do', 'Write the spec');
  await cardHandle(alice, 'To do', 'Write the spec').click();
  await expect(cardDialog(alice)).toBeVisible();
  await description(alice).click();
  await alice.keyboard.type('Hello from Alice.');
  await expect(card(bob, 'To do', 'Write the spec').getByTestId('card-editing')).toHaveText(
    'Alice is editing…',
  );

  // Bob opens it with the keyboard (Enter), sees the text and Alice's caret, and types too.
  await cardHandle(bob, 'To do', 'Write the spec').focus();
  await bob.keyboard.press('Enter');
  await expect.poll(() => descriptionText(bob)).toBe('Hello from Alice.');
  await expect(cardDialog(bob).locator('.collaboration-caret')).toHaveText('Alice');
  await description(bob).click();
  await bob.keyboard.press('End');
  await bob.keyboard.type(' And Bob.');
  await expect.poll(() => descriptionText(alice)).toBe('Hello from Alice. And Bob.');
  await expect(cardDialog(alice).locator('.collaboration-caret')).toHaveText('Bob');

  // Closing the dialogs clears the indicator; the card shows it has a description.
  await alice.keyboard.press('Escape');
  await bob.keyboard.press('Escape');
  await expect(card(alice, 'To do', 'Write the spec').getByTestId('card-editing')).toHaveCount(0);
  await expect(card(bob, 'To do', 'Write the spec').getByTestId('card-editing')).toHaveCount(0);

  await close();
});

test('offline edits sync on reconnect and undo only touches your own changes', async ({
  browser,
}) => {
  const { alice, bob, aliceContext, close } = await openSharedBoard(browser, 'Offline');

  // The board is cached locally (IndexedDB) for offline use.
  await expect.poll(() => offlineDatabases(alice)).toHaveLength(1);

  // Alice loses the network and keeps working.
  await aliceContext.setOffline(true);
  await expect(status(alice)).toHaveText('Offline');
  await addCard(alice, 'To do', 'Written offline');
  await expect(card(alice, 'To do', 'Written offline')).toBeVisible();
  await bob.waitForTimeout(1000);
  await expect(card(bob, 'To do', 'Written offline')).toHaveCount(0);

  // Back online: her change reaches Bob without any action.
  await aliceContext.setOffline(false);
  await expect(status(alice)).toHaveText('Online');
  await expect(card(bob, 'To do', 'Written offline')).toBeVisible();

  // Both add a card; Alice's undo removes only hers, redo brings it back.
  await addCard(alice, 'In progress', "Alice's card");
  await expect(card(bob, 'In progress', "Alice's card")).toBeVisible();
  await addCard(bob, 'In progress', "Bob's card");
  await expect(card(alice, 'In progress', "Bob's card")).toBeVisible();

  await blur(alice);
  await alice.keyboard.press('Control+z');
  await expect(card(bob, 'In progress', "Alice's card")).toHaveCount(0);
  await expect(card(alice, 'In progress', "Alice's card")).toHaveCount(0);
  await expect(card(alice, 'In progress', "Bob's card")).toBeVisible();
  await expect(card(bob, 'In progress', "Bob's card")).toBeVisible();

  await alice.keyboard.press('Control+Shift+z');
  await expect(card(bob, 'In progress', "Alice's card")).toBeVisible();

  // Bob's undo, likewise, only reverts Bob's card.
  await blur(bob);
  await bob.getByRole('button', { name: 'Undo' }).click();
  await expect(card(alice, 'In progress', "Bob's card")).toHaveCount(0);
  await expect(card(alice, 'In progress', "Alice's card")).toBeVisible();
  await expect(card(alice, 'To do', 'Written offline')).toBeVisible();

  // Signing out removes the local copies.
  await alice.getByRole('button', { name: 'Alice', exact: true }).click();
  await alice.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(alice).toHaveURL(/\/login/);
  await expect.poll(() => offlineDatabases(alice)).toHaveLength(0);

  await close();
});
