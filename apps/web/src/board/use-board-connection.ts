import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import { createBoardUndoManager, getColumns } from '@realtime-kanban/board-doc';
import { useMemo, useSyncExternalStore } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { config } from '@/lib/config';
import { boardCacheName } from '@/lib/offline';
import { session } from '@/lib/session';

import { LOCAL_ORIGIN } from './origin';
import type { PresenceUser } from './presence';

/**
 * - `connecting`: first connection, nothing confirmed yet
 * - `online`: connected and every local change acknowledged by the server
 * - `syncing`: connected, exchanging changes (initial sync or local edits in flight)
 * - `offline`: no connection; edits are kept locally and sent on reconnect
 * - `forbidden`: the server refused access
 */
export type ConnectionStatus = 'connecting' | 'online' | 'syncing' | 'offline' | 'forbidden';

export interface BoardConnection {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  awareness: Awareness;
  undoManager: Y.UndoManager;
  status: ConnectionStatus;
  /** True once there is board content to show: from the offline cache or the server. */
  ready: boolean;
  /** Viewers and archived boards get a read-only connection (until the server says otherwise). */
  readOnly: boolean;
}

export interface RawState {
  socket: WebSocketStatus;
  authenticated: boolean;
  synced: boolean;
  /** Local changes waiting for the server's acknowledgement for longer than `SLOW_ACK_MS`. */
  slowAck: boolean;
  everConnected: boolean;
  forbidden: boolean;
  browserOnline: boolean;
  ready: boolean;
  readOnly: boolean;
}

export function deriveStatus(raw: RawState): ConnectionStatus {
  if (raw.forbidden) return 'forbidden';
  if (raw.socket === WebSocketStatus.Connected && raw.authenticated) {
    return raw.synced && !raw.slowAck ? 'online' : 'syncing';
  }
  if (raw.browserOnline && !raw.everConnected) return 'connecting';
  return 'offline';
}

const hasContent = (doc: Y.Doc) => getColumns(doc).size > 0;

/**
 * Edits are normally acknowledged within milliseconds; flagging every keystroke as "Syncing"
 * would make the badge (an ARIA live region) flicker. Only slow acknowledgements count.
 */
const SLOW_ACK_MS = 1000;

/**
 * Owns everything attached to one open board: the `Y.Doc`, its IndexedDB copy, the Hocuspocus
 * connection, presence (awareness) and the per-user undo manager. It opens with the first
 * subscriber and closes with the last one, so React (including StrictMode's double mount)
 * drives the lifecycle through `useSyncExternalStore` (ADR 0017, 0019).
 */
class BoardConnectionStore {
  readonly #boardId: string;
  readonly #user: PresenceUser;
  readonly #listeners = new Set<() => void>();
  #snapshot: BoardConnection | null = null;
  #raw: RawState | null = null;
  #cleanup: (() => void) | null = null;

  constructor(boardId: string, user: PresenceUser) {
    this.#boardId = boardId;
    this.#user = user;
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
    const cache = new IndexeddbPersistence(boardCacheName(this.#user.id, this.#boardId), doc);
    let retriedAuth = false;
    let reauthenticating = false;
    let slowAckTimer: ReturnType<typeof setTimeout> | null = null;

    const provider: HocuspocusProvider = new HocuspocusProvider({
      url: config.collabUrl,
      name: `board:${this.#boardId}`,
      document: doc,
      token: () => session.accessToken ?? '',
      onStatus: ({ status }) => {
        this.#patch(provider, {
          socket: status,
          ...(status !== WebSocketStatus.Connected && { authenticated: false, synced: false }),
        });
        // An `online` event can arrive while the socket closed by `offline` is still closing;
        // `connect()` is a no-op then, so retry once it is really down.
        const socket = provider.configuration.websocketProvider;
        if (status === WebSocketStatus.Disconnected && navigator.onLine && !socket.shouldConnect) {
          void provider.connect();
        }
      },
      onAuthenticated: ({ scope }) => {
        retriedAuth = false;
        reauthenticating = false;
        this.#patch(provider, {
          authenticated: true,
          everConnected: true,
          forbidden: false,
          readOnly: scope === 'readonly',
        });
      },
      onSynced: ({ state }) => this.#patch(provider, { synced: state, ready: true }),
      onUnsyncedChanges: ({ number }) => {
        if (number === 0) {
          if (slowAckTimer) clearTimeout(slowAckTimer);
          slowAckTimer = null;
          this.#patch(provider, { slowAck: false });
        } else {
          slowAckTimer ??= setTimeout(() => {
            slowAckTimer = null;
            if (provider.hasUnsyncedChanges) this.#patch(provider, { slowAck: true });
          }, SLOW_ACK_MS);
        }
      },
      onAuthenticationFailed: () => {
        reauthenticating = false;
        if (retriedAuth) {
          this.#forbid(provider, cache);
          return;
        }
        retriedAuth = true;
        void session.refresh().then(async (ok) => {
          if (ok) await provider.sendToken();
          else this.#forbid(provider, cache);
        });
      },
      // The server closes a single document (not the socket) when a renewed token is rejected
      // or the role changed. Authenticate it again on the same socket with the current token;
      // a refusal then goes through `onAuthenticationFailed`. (The provider reports a document
      // close twice, hence the flag.)
      onClose: () => {
        const socket = provider.configuration.websocketProvider;
        if (socket.status !== WebSocketStatus.Connected || reauthenticating) return;
        reauthenticating = true;
        void provider.sendToken().then(() => provider.startSync());
      },
    });

    const awareness = provider.awareness;
    if (!awareness) throw new Error('Hocuspocus provider has no awareness');
    awareness.setLocalStateField('user', this.#user);

    const undoManager = createBoardUndoManager(doc, LOCAL_ORIGIN);

    void cache.whenSynced.then(() => {
      if (hasContent(doc)) this.#patch(provider, { ready: true });
    });

    // The browser knows about lost connectivity long before the socket times out; going offline
    // explicitly also stops reconnect attempts until the network is back.
    const onOffline = () => {
      provider.disconnect();
      this.#patch(provider, { browserOnline: false });
    };
    const onOnline = () => {
      this.#patch(provider, { browserOnline: true });
      void provider.connect();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // A refreshed access token is sent on the open connection (validated by the server).
    let lastToken = session.accessToken;
    const unsubscribeSession = session.subscribe(() => {
      const token = session.accessToken;
      if (token && token !== lastToken && provider.isAuthenticated) void provider.sendToken();
      lastToken = token;
    });

    this.#cleanup = () => {
      if (slowAckTimer) clearTimeout(slowAckTimer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      unsubscribeSession();
      undoManager.destroy();
      provider.destroy();
      void cache.destroy();
      doc.destroy();
    };

    this.#raw = {
      socket: WebSocketStatus.Connecting,
      authenticated: false,
      synced: false,
      slowAck: false,
      everConnected: false,
      forbidden: false,
      browserOnline: navigator.onLine,
      ready: false,
      readOnly: true,
    };
    this.#snapshot = {
      doc,
      provider,
      awareness,
      undoManager,
      status: deriveStatus(this.#raw),
      ready: false,
      readOnly: true,
    };
    if (!navigator.onLine) onOffline();
  }

  #close(): void {
    this.#cleanup?.();
    this.#cleanup = null;
    this.#snapshot = null;
    this.#raw = null;
  }

  /** Access was refused: also drop the local copy of a board this user can no longer open. */
  #forbid(provider: HocuspocusProvider, cache: IndexeddbPersistence): void {
    this.#patch(provider, { forbidden: true });
    void cache.clearData();
  }

  /** Applies a patch unless the event comes from a provider that was already closed. */
  #patch(provider: HocuspocusProvider, patch: Partial<RawState>): void {
    if (this.#snapshot?.provider !== provider || !this.#raw) return;
    const raw = { ...this.#raw, ...patch };
    this.#raw = raw;
    const next = {
      status: deriveStatus(raw),
      ready: raw.ready,
      readOnly: raw.readOnly,
    };
    const current = this.#snapshot;
    if (
      current.status === next.status &&
      current.ready === next.ready &&
      current.readOnly === next.readOnly
    ) {
      return;
    }
    this.#snapshot = { ...current, ...next };
    for (const listener of this.#listeners) listener();
  }
}

export function useBoardConnection(boardId: string, user: PresenceUser): BoardConnection | null {
  // The user only changes with the session, which remounts the board page.
  const { id, name, color, avatarUrl } = user;
  const store = useMemo(
    () => new BoardConnectionStore(boardId, { id, name, color, avatarUrl }),
    [boardId, id, name, color, avatarUrl],
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
