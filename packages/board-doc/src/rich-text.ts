import * as Y from 'yjs';

import type { OperationOptions } from './operations.js';
import { getCards } from './schema.js';

/** Element name the editor (ProseMirror/TipTap) uses for a plain paragraph. */
const PARAGRAPH = 'paragraph';

function textOfXmlText(text: Y.XmlText): string {
  return (text.toDelta() as { insert?: unknown }[])
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('');
}

/**
 * Plain-text projection of a rich text fragment: block elements (paragraphs, headings, list
 * items) are separated by new lines and formatting is dropped. Used for previews and search.
 */
export function richTextToPlainText(node: Y.XmlFragment | Y.XmlElement): string {
  const children = node.toArray();
  const hasBlocks = children.some((child) => child instanceof Y.XmlElement);
  return children
    .map((child) => {
      if (child instanceof Y.XmlText) return textOfXmlText(child);
      if (child instanceof Y.XmlElement) return richTextToPlainText(child);
      return '';
    })
    .join(hasBlocks ? '\n' : '');
}

/** Builds paragraphs from plain text, one per line. */
export function plainTextToParagraphs(text: string): Y.XmlElement[] {
  if (text === '') return [];
  return text.split('\n').map((line) => {
    const paragraph = new Y.XmlElement(PARAGRAPH);
    if (line !== '') paragraph.insert(0, [new Y.XmlText(line)]);
    return paragraph;
  });
}

/**
 * Brings documents written by older versions up to the current schema. Idempotent; the collab
 * server runs it once when it loads a document, so clients never race to migrate the same field.
 *
 * - v1 → v2: card descriptions were `Y.Text`; they become `Y.XmlFragment` paragraphs (ADR 0021).
 *
 * Returns the number of cards that changed.
 */
export function upgradeBoard(doc: Y.Doc, options: OperationOptions = {}): number {
  let changed = 0;
  doc.transact(() => {
    getCards(doc).forEach((card) => {
      const description = card.get('description');
      if (description instanceof Y.XmlFragment) return;
      const fragment = new Y.XmlFragment();
      const text = description instanceof Y.Text ? description.toJSON() : '';
      const paragraphs = plainTextToParagraphs(text);
      if (paragraphs.length > 0) fragment.insert(0, paragraphs);
      card.set('description', fragment);
      changed += 1;
    });
  }, options.origin);
  return changed;
}
