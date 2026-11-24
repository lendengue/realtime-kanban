import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { colorFor, readPeers, throttle, uniqueUsers, type PresenceUser } from './presence';

const alice: PresenceUser = { id: 'a', name: 'Alice', color: '#e11d48', avatarUrl: null };

/** An awareness instance with remote states injected as if received from other clients. */
function awarenessWith(states: Record<number, unknown>) {
  const awareness = new Awareness(new Y.Doc());
  awareness.setLocalStateField('user', alice);
  for (const [clientId, state] of Object.entries(states)) {
    awareness.states.set(Number(clientId), state as Record<string, unknown>);
  }
  return awareness;
}

describe('readPeers', () => {
  it('returns remote peers only, ordered by client id', () => {
    const bob = { id: 'b', name: 'Bob', color: '#2563eb', avatarUrl: null };
    const awareness = awarenessWith({
      20: { user: bob, cursor: { x: 10, y: 20 }, editingCardId: 'card-1' },
      10: { user: bob },
    });
    expect(readPeers(awareness)).toEqual([
      { clientId: 10, user: bob, cursor: null, editingCardId: null, viewingCardId: null },
      {
        clientId: 20,
        user: bob,
        cursor: { x: 10, y: 20 },
        editingCardId: 'card-1',
        viewingCardId: null,
      },
    ]);
  });

  it('drops states that could inject markup or styles, and sanitises optional fields', () => {
    const awareness = awarenessWith({
      1: { user: { id: 'x', name: 'Mallory', color: 'red; background: url(//evil)' } },
      2: { user: { id: 'y', name: 42, color: '#000000' } },
      3: {},
      4: {
        user: { id: 'z', name: 'Eve', color: '#123456', avatarUrl: 'javascript:alert(1)' },
        cursor: { x: 'left', y: 0 },
        editingCardId: { $: 1 },
      },
    });
    expect(readPeers(awareness)).toEqual([
      {
        clientId: 4,
        user: { id: 'z', name: 'Eve', color: '#123456', avatarUrl: null },
        cursor: null,
        editingCardId: null,
        viewingCardId: null,
      },
    ]);
  });
});

describe('uniqueUsers', () => {
  it('lists a user with several tabs once', () => {
    const awareness = awarenessWith({
      1: { user: { ...alice, id: 'b', name: 'Bob' } },
      2: { user: { ...alice, id: 'b', name: 'Bob' } },
      3: { user: { ...alice, id: 'c', name: 'Carol' } },
    });
    expect(uniqueUsers(readPeers(awareness)).map((user) => user.name)).toEqual(['Bob', 'Carol']);
  });
});

describe('colorFor', () => {
  it('gives every client the same valid color for a user', () => {
    expect(colorFor('user-1')).toBe(colorFor('user-1'));
    expect(colorFor('0198f3c2-0000-7000-8000-000000000000')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the first call at once and at most one trailing call per window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn.mock.calls).toEqual([[1]]);
    vi.advanceTimersByTime(50);
    expect(fn.mock.calls).toEqual([[1], [3]]);
    vi.advanceTimersByTime(100);
    throttled(4);
    expect(fn.mock.calls).toEqual([[1], [3], [4]]);
  });

  it('can cancel a pending trailing call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled(1);
    throttled(2);
    throttled.cancel();
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1]]);
  });
});
