import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { createCard, getCardDescription, initializeBoard } from './operations.js';
import { readBoard } from './read.js';
import { plainTextToParagraphs, richTextToPlainText, upgradeBoard } from './rich-text.js';
import { getCards } from './schema.js';
import { syncAll } from './test/helpers.js';

function boardWithCard() {
  const doc = new Y.Doc();
  initializeBoard(doc, { title: 'Board' });
  const columnId = readBoard(doc).columns[0]?.id;
  if (!columnId) throw new Error('no column');
  const cardId = createCard(doc, { columnId, title: 'Card', createdBy: 'u1' });
  return { doc, cardId };
}

const descriptionOf = (doc: Y.Doc) => readBoard(doc).columns[0]?.cards[0]?.description;

describe('rich text descriptions', () => {
  it('projects paragraphs, headings and formatting to plain text', () => {
    const { doc, cardId } = boardWithCard();
    const fragment = getCardDescription(doc, cardId);
    const heading = new Y.XmlElement('heading');
    const bold = new Y.XmlText();
    bold.insert(0, 'Plan');
    bold.format(0, 4, { bold: true });
    heading.insert(0, [bold]);
    const list = new Y.XmlElement('bulletList');
    const item = new Y.XmlElement('listItem');
    item.insert(0, plainTextToParagraphs('First'));
    list.insert(0, [item]);
    fragment.insert(0, [heading, ...plainTextToParagraphs('Line 1\n\nLine 3'), list]);

    expect(richTextToPlainText(fragment)).toBe('Plan\nLine 1\n\nLine 3\nFirst');
    expect(descriptionOf(doc)).toBe('Plan\nLine 1\n\nLine 3\nFirst');
  });

  it('treats an empty fragment as an empty description', () => {
    const { doc } = boardWithCard();
    expect(descriptionOf(doc)).toBe('');
    expect(plainTextToParagraphs('')).toEqual([]);
  });

  it('keeps concurrent edits from two replicas', () => {
    const { doc: a, cardId } = boardWithCard();
    const b = new Y.Doc();
    syncAll([a, b]);
    getCardDescription(a, cardId).insert(0, plainTextToParagraphs('From A'));
    getCardDescription(b, cardId).insert(0, plainTextToParagraphs('From B'));
    syncAll([a, b]);
    expect(descriptionOf(a)).toBe(descriptionOf(b));
    expect(descriptionOf(a)?.split('\n').sort()).toEqual(['From A', 'From B']);
  });
});

describe('upgradeBoard', () => {
  it('converts legacy Y.Text descriptions into paragraphs, once', () => {
    const { doc, cardId } = boardWithCard();
    const card = getCards(doc).get(cardId);
    const legacy = new Y.Text();
    card?.set('description', legacy);
    legacy.insert(0, 'Hello\nworld');
    expect(descriptionOf(doc)).toBe('Hello\nworld');

    const origin = Symbol('upgrade');
    const origins: unknown[] = [];
    doc.on('afterTransaction', (transaction: Y.Transaction) => origins.push(transaction.origin));
    expect(upgradeBoard(doc, { origin })).toBe(1);
    expect(origins).toEqual([origin]);
    expect(getCardDescription(doc, cardId).length).toBe(2);
    expect(descriptionOf(doc)).toBe('Hello\nworld');

    expect(upgradeBoard(doc)).toBe(0);
  });

  it('gives cards without a description an empty one', () => {
    const { doc, cardId } = boardWithCard();
    getCards(doc).get(cardId)?.delete('description');
    expect(descriptionOf(doc)).toBe('');
    expect(upgradeBoard(doc)).toBe(1);
    expect(getCardDescription(doc, cardId).length).toBe(0);
  });
});
