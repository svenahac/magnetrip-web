import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAuthEntryPath, isProtectedPath } from '@/lib/auth/routes';

function withRefreshedCookies(redirect: NextResponse, response: NextResponse): NextResponse {
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // Unauthenticated users hitting a protected page → login (remember where they were going).
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname + search);
    return withRefreshedCookies(NextResponse.redirect(url), response);
  }

  // Authenticated users hitting an auth entry screen (login/signup/forgot) → dashboard.
  // Note: /reset-password is intentionally excluded — Supabase password recovery establishes
  // a real authenticated session before the user sets a new password, so bouncing them off
  // /reset-password here would make the recovery flow unreachable.
  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return withRefreshedCookies(NextResponse.redirect(url), response);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets; the callback route is
  // intentionally included so session cookies refresh there too.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
