import { describe, expect, it } from 'vitest';

import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it.each([
    ['/w/acme', '/w/acme'],
    ['/invite/abc?x=1', '/invite/abc?x=1'],
    [undefined, '/w'],
    ['https://evil.example', '/w'],
    ['//evil.example', '/w'],
    ['/\\evil.example', '/w'],
    ['w/acme', '/w'],
  ])('%j -> %j', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});
