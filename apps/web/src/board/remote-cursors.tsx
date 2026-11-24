import type { Awareness } from 'y-protocols/awareness';

import { usePeers } from './presence';

/** Other users' pointers, positioned inside the board's scroll container. */
export function RemoteCursors({ awareness }: { awareness: Awareness }) {
  const cursors = usePeers(awareness, (peers) =>
    peers.flatMap(({ clientId, cursor, user }) => (cursor ? [{ clientId, cursor, user }] : [])),
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-40 overflow-visible">
      {cursors.map(({ clientId, cursor, user }) => (
        <div
          key={clientId}
          data-testid="remote-cursor"
          className="absolute top-0 left-0 flex items-start gap-1 transition-transform duration-75 ease-linear"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="drop-shadow-sm">
            <path
              d="M1 1 L1 13 L4.5 9.5 L7 15 L9 14 L6.5 8.5 L11.5 8.5 Z"
              fill={user.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          <span
            className="mt-3 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-sm"
            style={{ backgroundColor: user.color }}
          >
            {user.name}
          </span>
        </div>
      ))}
    </div>
  );
}
