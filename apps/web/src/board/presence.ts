import type { User } from '@realtime-kanban/shared';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import { z } from 'zod';

/**
 * Awareness state each client publishes (spec 4.5). `caret` is the rich text selection of the
 * description editor, kept apart from the board pointer `cursor` (ADR 0018).
 */
export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
}

export interface Peer {
  clientId: number;
  user: PresenceUser;
  /** Pointer position relative to the board canvas content. */
  cursor: { x: number; y: number } | null;
  editingCardId: string | null;
  viewingCardId: string | null;
}

/** Awareness comes from other clients: validate it before it reaches the DOM. */
const presenceUserSchema = z.object({
  id: z.string().max(64),
  name: z.string().max(100),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  avatarUrl: z
    .string()
    .max(2048)
    .refine((url) => /^https?:\/\//i.test(url))
    .nullable()
    .catch(null),
});

const cursorSchema = z.object({ x: z.number(), y: z.number() }).nullable().catch(null);

const cardIdSchema = z.string().max(64).nullable().catch(null);

const peerStateSchema = z.object({
  user: presenceUserSchema,
  cursor: cursorSchema.optional(),
  editingCardId: cardIdSchema.optional(),
  viewingCardId: cardIdSchema.optional(),
});

/** Remote peers with a valid presence state (other tabs of the same user included). */
export function readPeers(awareness: Awareness): Peer[] {
  const peers: Peer[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId === awareness.clientID) return;
    const parsed = peerStateSchema.safeParse(state);
    if (!parsed.success) return;
    peers.push({
      clientId,
      user: parsed.data.user,
      cursor: parsed.data.cursor ?? null,
      editingCardId: parsed.data.editingCardId ?? null,
      viewingCardId: parsed.data.viewingCardId ?? null,
    });
  });
  return peers.sort((a, b) => a.clientId - b.clientId);
}

/**
 * Selects a value from the remote peers and re-renders only when it changes (compared by its
 * JSON), so components that only care about avatars do not re-render on every pointer move.
 */
export function usePeers<T>(awareness: Awareness, select: (peers: Peer[]) => T): T {
  const cache = useRef<{ key: string; value: T } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      awareness.on('change', onChange);
      return () => awareness.off('change', onChange);
    },
    [awareness],
  );

  const getSnapshot = useCallback(() => {
    const value = select(readPeers(awareness));
    const key = JSON.stringify(value);
    if (cache.current?.key !== key) cache.current = { key, value };
    return cache.current.value;
  }, [awareness, select]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** One entry per user (a user may have several tabs open). */
export function uniqueUsers(peers: Peer[]): PresenceUser[] {
  const byId = new Map<string, PresenceUser>();
  for (const peer of peers) if (!byId.has(peer.user.id)) byId.set(peer.user.id, peer.user);
  return [...byId.values()];
}

const COLORS = [
  '#e11d48',
  '#db2777',
  '#9333ea',
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#d97706',
  '#ea580c',
];

/** Stable color per user, the same in every client. */
export function colorFor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length] ?? '#2563eb';
}

export function toPresenceUser(user: User): PresenceUser {
  return { id: user.id, name: user.name, color: colorFor(user.id), avatarUrl: user.avatarUrl };
}

/**
 * Leading + trailing throttle: the first call runs immediately, later calls within `ms` collapse
 * into one trailing call with the latest arguments.
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const run = (args: A) => {
    last = Date.now();
    fn(...args);
  };

  const throttled = (...args: A) => {
    const wait = ms - (Date.now() - last);
    if (wait <= 0 && !timer) {
      run(args);
      return;
    }
    pending = args;
    timer ??= setTimeout(
      () => {
        timer = null;
        if (pending) run(pending);
        pending = null;
      },
      Math.max(wait, 0),
    );
  };

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return throttled;
}
