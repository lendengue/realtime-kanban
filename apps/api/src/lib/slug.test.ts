import { describe, expect, it } from 'vitest';

import { slugify, withRandomSuffix } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Acme Inc.', 'acme-inc'],
    ['  Équipe Ação  ', 'equipe-acao'],
    ['***', 'workspace'],
  ])('turns %j into %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('adds a random suffix', () => {
    expect(withRandomSuffix('acme')).toMatch(/^acme-[0-9a-f]{6}$/);
  });
});
