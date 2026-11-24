import { expect, test } from '@playwright/test';

import { addCard, card, cardHandle, column, openSharedBoard } from './support.js';

test('two users edit the same board in real time', async ({ browser }) => {
  const { alice, bob, close } = await openSharedBoard(browser, 'Realtime');

  // Alice creates a card; Bob sees it without reloading.
  await addCard(alice, 'To do', 'Hello from Alice');
  await expect(card(bob, 'To do', 'Hello from Alice')).toBeVisible();

  // Bob moves it to "In progress" with the keyboard only; Alice sees the move.
  const handle = cardHandle(bob, 'To do', 'Hello from Alice');
  // Each step waits for dnd-kit's screen-reader announcement, like an assistive-tech user would.
  const announcer = bob.locator('[id^="DndLiveRegion"]');
  await handle.focus();
  await bob.keyboard.press('Space');
  await expect(announcer).toContainText('Hello from Alice is over');
  // dnd-kit starts listening for arrow keys one tick after the pick-up, so a key sent right
  // away can be lost on a busy machine: retry until the move is announced.
  await expect(async () => {
    await bob.keyboard.press('ArrowRight');
    await expect(announcer).toContainText('is over In progress', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
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

  await close();
});
