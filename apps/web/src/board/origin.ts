/**
 * Transaction origin for every change made by this tab. The per-user undo manager (phase 3)
 * tracks only this origin, so it never undoes someone else's edits.
 */
export const LOCAL_ORIGIN = Symbol('realtime-kanban:local');

export const local = { origin: LOCAL_ORIGIN } as const;
