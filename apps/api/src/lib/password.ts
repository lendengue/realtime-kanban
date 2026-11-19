import argon2 from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Spend comparable time when the user does not exist, to avoid leaking valid e-mails by timing. */
export async function simulatePasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('realtime-kanban-dummy-password');
  await verifyPassword(await dummyHash, password);
}
