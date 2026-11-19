import { describe, expect, it } from 'vitest';

import { comparePositioned, positionBetween } from './position.js';

const items = (...positions: string[]) =>
  positions.map((position, index) => ({ id: `id-${index}`, position }));

describe('comparePositioned', () => {
  it('orders by position, then by id', () => {
    const list = [
      { id: 'b', position: 'a1' },
      { id: 'a', position: 'a1' },
      { id: 'c', position: 'a0' },
      { id: 'd', position: 'Zz' },
    ];
    expect([...list].sort(comparePositioned).map((item) => item.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(comparePositioned(list[0]!, list[0]!)).toBe(0);
  });
});

describe('positionBetween', () => {
  const siblings = items('a0', 'a1', 'a2');

  it('appends at the end by default', () => {
    expect(positionBetween(siblings) > 'a2').toBe(true);
    expect(positionBetween([])).toBe('a0');
  });

  it('inserts right below `beforeId`', () => {
    const position = positionBetween(siblings, 'id-0');
    expect(position > 'a0' && position < 'a1').toBe(true);
  });

  it('inserts right above `afterId` (takes precedence)', () => {
    const top = positionBetween(siblings, undefined, 'id-0');
    expect(top < 'a0').toBe(true);
    const middle = positionBetween(siblings, 'id-0', 'id-2');
    expect(middle > 'a1' && middle < 'a2').toBe(true);
  });

  it('ignores unknown neighbours and appends', () => {
    expect(positionBetween(siblings, 'missing', 'gone') > 'a2').toBe(true);
  });

  it('stays strictly increasing when neighbours share a key (concurrent ties)', () => {
    const tied = items('a0', 'a1', 'a1', 'a2');
    const position = positionBetween(tied, 'id-1');
    expect(position > 'a1' && position < 'a2').toBe(true);
  });
});
