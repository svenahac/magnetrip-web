export const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'] as const;

export const AUTH_ENTRY_PATHS = ['/login', '/signup', '/forgot-password'] as const;

export const PROTECTED_PREFIXES = ['/dashboard'] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p);
}

export function isAuthEntryPath(pathname: string): boolean {
  return AUTH_ENTRY_PATHS.some((p) => pathname === p);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Returns `next` only if it is a safe same-origin relative path; otherwise the dashboard.
 *  Prevents open redirects (protocol-relative //, backslash tricks, absolute URLs, userinfo @). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/dashboard';
  }
  return next;
}
