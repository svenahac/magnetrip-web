export const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'] as const;

export const PROTECTED_PREFIXES = ['/dashboard'] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
