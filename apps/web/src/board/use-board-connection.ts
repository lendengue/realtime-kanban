import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import { useMemo, useSyncExternalStore } from 'react';
import * as Y from 'yjs';

import { config } from '@/lib/config';
import { session } from '@/lib/session';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'forbidden';

export interface BoardConnection {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  status: ConnectionStatus;
  /** True once the first full sync with the server finished. */
  synced: boolean;
  /** Viewers and archived boards get a read-only connection. */
  readOnly: boolean;
}

const STATUS: Record<WebSocketStatus, ConnectionStatus> = {
  [WebSocketStatus.Connecting]: 'connecting',
  [WebSocketStatus.Connected]: 'connected',
  [WebSocketStatus.Disconnected]: 'disconnected',
};

/**
 * Owns the Hocuspocus connection of one board. The connection opens with the first subscriber
 * and closes with the last one, so React (including StrictMode's double mount) drives the
 * lifecycle through `useSyncExternalStore`.
 *
 * The access token is read from memory on every (re)connect; when the server rejects it, the
 * session is refreshed once and the new token is sent again.
 */
class BoardConnectionStore {
  readonly #boardId: string;
  readonly #listeners = new Set<() => void>();
  #snapshot: BoardConnection | null = null;
  #retriedAuth = false;

  constructor(boardId: string) {
    this.#boardId = boardId;
  }

  getSnapshot = (): BoardConnection | null => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (!this.#snapshot) this.#open();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#close();
    };
  };

  #open(): void {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: config.collabUrl,
      name: `board:${this.#boardId}`,
      document: doc,
      token: () => session.accessToken ?? '',
      onStatus: ({ status }) => {
        if (this.#snapshot?.status !== 'forbidden')
          this.#update(provider, { status: STATUS[status] });
      },
      onAuthenticated: ({ scope }) => {
        this.#retriedAuth = false;
        this.#update(provider, { readOnly: scope === 'readonly', status: 'connected' });
      },
      onSynced: ({ state }) => this.#update(provider, { synced: state }),
      onAuthenticationFailed: () => {
        if (this.#retriedAuth) {
          this.#update(provider, { status: 'forbidden' });
          return;
        }
        this.#retriedAuth = true;
        void session.refresh().then(async (ok) => {
          if (ok) await provider.sendToken();
          else this.#update(provider, { status: 'forbidden' });
        });
      },
    });
    this.#snapshot = { doc, provider, status: 'connecting', synced: false, readOnly: true };
  }

  #close(): void {
    this.#snapshot?.provider.destroy();
    this.#snapshot?.doc.destroy();
    this.#snapshot = null;
  }

  /** Applies a patch unless the event comes from a provider that was already closed. */
  #update(provider: HocuspocusProvider, patch: Partial<BoardConnection>): void {
    if (this.#snapshot?.provider !== provider) return;
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }
}

export function useBoardConnection(boardId: string): BoardConnection | null {
  const store = useMemo(() => new BoardConnectionStore(boardId), [boardId]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
