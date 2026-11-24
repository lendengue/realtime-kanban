/**
 * Local copies of board documents live in IndexedDB, one database per user and board, so two
 * accounts on the same browser never share a cache (ADR 0019).
 */
const PREFIX = 'realtime-kanban:';

export const boardCacheName = (userId: string, boardId: string) =>
  `${PREFIX}${userId}:board:${boardId}`;

/** Deletes every cached board of `userId` (all users when omitted). Called on sign-out. */
export async function clearOfflineData(userId?: string): Promise<void> {
  if (typeof indexedDB === 'undefined' || !('databases' in indexedDB)) return;
  const prefix = userId ? `${PREFIX}${userId}:` : PREFIX;
  const databases = await indexedDB.databases();
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => name?.startsWith(prefix) === true)
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = request.onerror = request.onblocked = () => resolve();
          }),
      ),
  );
}
