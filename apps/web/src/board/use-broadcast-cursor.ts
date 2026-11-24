import { useEffect, useMemo, type RefObject } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import { throttle } from './presence';

/** Pointer updates are sent at most every 50 ms (spec 4.5). */
export const CURSOR_THROTTLE_MS = 50;

/**
 * Publishes this user's pointer, relative to the scrollable board content, while it is over the
 * board; clears it when the pointer leaves.
 */
export function useBroadcastCursor(
  awareness: Awareness,
  containerRef: RefObject<HTMLElement | null>,
) {
  const publish = useMemo(
    () =>
      throttle((cursor: { x: number; y: number } | null) => {
        awareness.setLocalStateField('cursor', cursor);
      }, CURSOR_THROTTLE_MS),
    [awareness],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      publish({
        x: Math.round(event.clientX - rect.left + container.scrollLeft),
        y: Math.round(event.clientY - rect.top + container.scrollTop),
      });
    };
    const onLeave = () => {
      publish.cancel();
      awareness.setLocalStateField('cursor', null);
    };
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', onLeave);
    return () => {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      onLeave();
    };
  }, [awareness, containerRef, publish]);
}
