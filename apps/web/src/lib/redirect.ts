/** Only allow same-app relative paths as post-login redirects (prevents open redirects). */
export function safeRedirect(target: string | undefined, fallback = '/w'): string {
  if (!target?.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback;
  }
  return target;
}
