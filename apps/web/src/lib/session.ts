import { authResponseSchema, type AuthResponse, type User } from '@realtime-kanban/shared';

import { API_BASE } from './config';

export type SessionState =
  | { status: 'unknown' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User; accessToken: string };

type Listener = () => void;

/**
 * In-memory session store. The access token never touches localStorage; on reload the session
 * is restored through the httpOnly refresh cookie (see docs/decisions/0010).
 */
class SessionStore {
  #state: SessionState = { status: 'unknown' };
  readonly #listeners = new Set<Listener>();
  #refreshInFlight: Promise<boolean> | null = null;

  getState = (): SessionState => this.#state;

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  get accessToken(): string | null {
    return this.#state.status === 'authenticated' ? this.#state.accessToken : null;
  }

  signIn(response: AuthResponse): void {
    this.#set({ status: 'authenticated', user: response.user, accessToken: response.accessToken });
  }

  signOut(): void {
    this.#set({ status: 'anonymous' });
  }

  /** Resolves `true` when there is (or could be restored) a session. */
  async ensure(): Promise<boolean> {
    if (this.#state.status === 'authenticated') return true;
    if (this.#state.status === 'anonymous') return false;
    return this.refresh();
  }

  /**
   * Rotates the refresh cookie. Calls are de-duplicated inside the tab and serialised across tabs
   * with the Web Locks API: the server revokes the whole token family if a rotated token is reused,
   * so two concurrent refreshes with the same cookie would log the user out.
   */
  refresh(): Promise<boolean> {
    this.#refreshInFlight ??= withCrossTabLock(() => this.#doRefresh()).finally(() => {
      this.#refreshInFlight = null;
    });
    return this.#refreshInFlight;
  }

  async #doRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        this.signOut();
        return false;
      }
      this.signIn(authResponseSchema.parse(await response.json()));
      return true;
    } catch {
      // Network failure: keep an existing session (offline), otherwise treat as signed out.
      if (this.#state.status !== 'authenticated') this.signOut();
      return this.#state.status === 'authenticated';
    }
  }

  #set(state: SessionState): void {
    this.#state = state;
    for (const listener of this.#listeners) listener();
  }
}

function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('realtime-kanban:refresh-session', fn);
  }
  return fn();
}

export const session = new SessionStore();
