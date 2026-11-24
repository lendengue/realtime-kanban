import { WebSocketStatus } from '@hocuspocus/provider';
import { describe, expect, it } from 'vitest';

import { deriveStatus, type RawState } from './use-board-connection';

const base: RawState = {
  socket: WebSocketStatus.Connected,
  authenticated: true,
  synced: true,
  slowAck: false,
  everConnected: true,
  forbidden: false,
  browserOnline: true,
  ready: true,
  readOnly: false,
};

describe('deriveStatus', () => {
  it('is online when connected, synced and nothing is waiting', () => {
    expect(deriveStatus(base)).toBe('online');
  });

  it('is syncing during the initial sync or when changes wait too long', () => {
    expect(deriveStatus({ ...base, synced: false })).toBe('syncing');
    expect(deriveStatus({ ...base, slowAck: true })).toBe('syncing');
    expect(deriveStatus({ ...base, authenticated: false })).not.toBe('online');
  });

  it('is connecting only before the first connection', () => {
    const first = { ...base, socket: WebSocketStatus.Connecting, authenticated: false };
    expect(deriveStatus({ ...first, everConnected: false })).toBe('connecting');
    expect(deriveStatus(first)).toBe('offline');
  });

  it('is offline when the browser has no network', () => {
    expect(
      deriveStatus({ ...base, socket: WebSocketStatus.Disconnected, browserOnline: false }),
    ).toBe('offline');
    expect(
      deriveStatus({
        ...base,
        socket: WebSocketStatus.Connecting,
        browserOnline: false,
        everConnected: false,
      }),
    ).toBe('offline');
  });

  it('reports a refused connection above everything else', () => {
    expect(deriveStatus({ ...base, forbidden: true })).toBe('forbidden');
  });
});
