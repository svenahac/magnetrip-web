# Magnetrip Phase 2a — Authentication & Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full email+password auth experience for the web app — login, signup, forgot-password, reset-password — with middleware-based route protection and session refresh, so a user can create an account, sign in, be kept signed in, reach a protected page, and sign out.

**Architecture:** Auth uses the Supabase SDK directly (allowed for auth/session; data still goes through the API layer in later phases). A browser client (`@supabase/ssr`) drives client-side auth actions; a middleware refreshes the session cookie on every request and guards the `(app)/*` route group. Email confirmation and password-reset links land on a server `/auth/callback` route that exchanges the PKCE code for a session, then redirects. A minimal protected `/dashboard` stub proves the end-to-end flow (Phase 2c replaces it with the real dashboard).

**Tech Stack:** Next.js 16 App Router (Server + Client Components, route handlers, middleware), React 19, TypeScript strict, `@supabase/ssr` + `@supabase/supabase-js`, Zod, shadcn/ui (Field/Input/Button/Sonner already installed), `lucide-react`, Vitest.

## Global Constraints

- Write only inside `magnetrip-web/` for this phase; nothing at repo root except the required `middleware.ts` (Next.js mandates it live at the project root, i.e. `magnetrip-web/middleware.ts` — that is the app root, not the monorepo root).
- Auth/session via the Supabase SDK is allowed. All non-auth **data** access must go through `app/api/*` (Phase 2b) — do NOT add trip/image data reads here.
- TypeScript strict; pnpm; Vitest. Light theme only. Design tokens only (no hardcoded colors/spacing) — use shadcn components + the Expedition theme.
- Email+password auth. Full set: login, signup, forgot-password (send reset email), reset-password (set new password). Signup + reset UIs on web.
- Public base URL: `NEXT_PUBLIC_SITE_URL=https://magnetrip-web.vercel.app`. Reset/confirm emails must redirect through `${NEXT_PUBLIC_SITE_URL}/auth/callback`.
- Every screen has loading, error, and (where relevant) empty/confirmation states with clear user-friendly messages (no raw error leakage).
- Font: the app font is **Plus Jakarta Sans** (Task 1 fixes the current Inter wiring).
- Both repos are on branch `feat/magnetrip-mvp`. Commit after each task (Conventional Commits).
- Reused from Phase 1: `getPublicEnv()` (`lib/env.ts`), `createServerSupabaseClient()` (`lib/supabase/server.ts`), `@/*` path alias → `./*`, Vitest config (`include: **/*.test.{ts,tsx,mjs}`, node env), shadcn components in `components/ui/` (button, input, field, label, sonner, spinner, card, alert).

## Dependencies & external config (verify before starting)

- In the **Supabase Dashboard → Authentication → URL Configuration**: Site URL = `https://magnetrip-web.vercel.app`; add `http://localhost:3000/**` and `https://magnetrip-web.vercel.app/**` to **Redirect URLs**. Without this, confirmation/reset links are rejected. (This is a dashboard step; note it in the final report — it cannot be done from code.)
- Email confirmation may be ON or OFF in the project. The signup flow (Task 8) handles both: session-present → go to dashboard; no session → show "check your email".

---

## File Structure

- `app/layout.tsx` — MODIFY: wire Plus Jakarta Sans to `--font-sans`; set real metadata.
- `lib/validation/auth.ts` — Zod schemas: `loginSchema`, `signupSchema`, `forgotPasswordSchema`, `resetPasswordSchema`.
- `lib/validation/auth.test.ts` — schema tests.
- `lib/auth/error-messages.ts` — `authErrorMessage(error): string` mapping Supabase errors to friendly copy.
- `lib/auth/error-messages.test.ts`.
- `lib/auth/routes.ts` — `AUTH_PATHS`, `PROTECTED_PREFIXES`, `isAuthPath(path)`, `isProtectedPath(path)`.
- `lib/auth/routes.test.ts`.
- `lib/supabase/client.ts` — `createBrowserSupabaseClient()` (browser `@supabase/ssr`).
- `lib/supabase/middleware.ts` — `updateSession(request): Promise<{ response, user }>`.
- `middleware.ts` — Next middleware: refresh session + redirect logic.
- `components/auth/auth-shell.tsx` — presentational card wrapper (logo, title, subtitle, children) shared by all auth pages.
- `app/(auth)/layout.tsx` — centered layout for auth pages.
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/forgot-password/page.tsx`
- `app/(auth)/reset-password/page.tsx`
- `app/auth/callback/route.ts` — PKCE code exchange → redirect.
- `app/(app)/layout.tsx` — authenticated shell (reads user; provides sign-out).
- `app/(app)/dashboard/page.tsx` — minimal protected stub (Phase 2c replaces).
- `components/auth/sign-out-button.tsx` — client sign-out control.
- `app/page.tsx` — MODIFY: redirect `/` → `/dashboard` (middleware sends unauthenticated users to `/login`).

---

## Task 1: Wire Plus Jakarta Sans and app metadata

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `--font-sans` = Plus Jakarta Sans across the app (consumed by Tailwind `font-sans` / the theme).

- [ ] **Step 1: Replace the font wiring and metadata**

Replace the entire contents of `app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Magnetrip",
  description: "Your trips, on a magnet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("h-full", jakarta.variable)}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the build and font wiring**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds. Then confirm the font is wired:
```bash
grep -q "Plus_Jakarta_Sans" app/layout.tsx && grep -q -- "--font-sans" app/layout.tsx && echo OK
```
Expected: `OK` (Plus Jakarta Sans imported and bound to `--font-sans`).

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add app/layout.tsx && git commit -m "feat(web): use Plus Jakarta Sans for --font-sans and set app metadata"
```

---

## Task 2: Auth validation schemas

**Files:**
- Create: `lib/validation/auth.ts`
- Create: `lib/validation/auth.test.ts`

**Interfaces:**
- Produces: `loginSchema`, `signupSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (Zod objects), and `LoginInput`, `SignupInput`, `ForgotPasswordInput`, `ResetPasswordInput` types.

- [ ] **Step 1: Write the failing test**

Create `lib/validation/auth.test.ts`:
```ts
import { test, expect } from 'vitest';
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

test('loginSchema requires a valid email and non-empty password', () => {
  expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret12' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret12' }).success).toBe(false);
  expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
});

test('signupSchema enforces min password length and matching confirmation', () => {
  expect(signupSchema.safeParse({ email: 'a@b.com', password: 'secret12', confirmPassword: 'secret12' }).success).toBe(true);
  expect(signupSchema.safeParse({ email: 'a@b.com', password: 'short', confirmPassword: 'short' }).success).toBe(false);
  const mismatch = signupSchema.safeParse({ email: 'a@b.com', password: 'secret12', confirmPassword: 'secret99' });
  expect(mismatch.success).toBe(false);
});

test('forgotPasswordSchema requires a valid email', () => {
  expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  expect(forgotPasswordSchema.safeParse({ email: 'x' }).success).toBe(false);
});

test('resetPasswordSchema enforces min length and matching confirmation', () => {
  expect(resetPasswordSchema.safeParse({ password: 'secret12', confirmPassword: 'secret12' }).success).toBe(true);
  expect(resetPasswordSchema.safeParse({ password: 'secret12', confirmPassword: 'nope' }).success).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/validation/auth.test.ts
```
Expected: FAIL — `./auth` cannot be resolved.

- [ ] **Step 3: Implement the schemas**

Create `lib/validation/auth.ts`:
```ts
import { z } from 'zod';

const email = z.string().trim().email('Enter a valid email address');
const password = z.string().min(8, 'Password must be at least 8 characters').max(72);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/validation/auth.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/validation/auth.ts lib/validation/auth.test.ts && git commit -m "feat(auth): add auth form validation schemas"
```

---

## Task 3: Auth error-message mapper

**Files:**
- Create: `lib/auth/error-messages.ts`
- Create: `lib/auth/error-messages.test.ts`

**Interfaces:**
- Produces: `authErrorMessage(error: unknown): string` — maps Supabase auth errors to friendly, user-safe copy; never returns an empty string.

- [ ] **Step 1: Write the failing test**

Create `lib/auth/error-messages.test.ts`:
```ts
import { test, expect } from 'vitest';
import { authErrorMessage } from './error-messages';

test('maps invalid credentials to a friendly message', () => {
  expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
    .toBe('Incorrect email or password.');
});

test('maps already-registered users', () => {
  expect(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' }))
    .toBe('An account with this email already exists.');
});

test('maps a rate-limit error', () => {
  expect(authErrorMessage({ code: 'over_email_send_rate_limit', message: 'rate limit' }))
    .toBe('Too many attempts. Please wait a moment and try again.');
});

test('falls back to a generic message for unknown errors', () => {
  expect(authErrorMessage({ message: 'weird internal thing' }))
    .toBe('Something went wrong. Please try again.');
  expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/auth/error-messages.test.ts
```
Expected: FAIL — `./error-messages` cannot be resolved.

- [ ] **Step 3: Implement the mapper**

Create `lib/auth/error-messages.ts`:
```ts
const GENERIC = 'Something went wrong. Please try again.';

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email before signing in.',
  user_already_exists: 'An account with this email already exists.',
  weak_password: 'Password is too weak. Use at least 8 characters.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  same_password: 'Your new password must be different from the old one.',
  otp_expired: 'This link has expired. Please request a new one.',
};

/** Map a Supabase auth error (or anything) to friendly, user-safe copy. */
export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return GENERIC;
  const e = error as { code?: string; message?: string };
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code];
  // Some errors only carry a message; match a couple of common ones defensively.
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return BY_CODE.invalid_credentials;
  if (msg.includes('already registered')) return BY_CODE.user_already_exists;
  return GENERIC;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/auth/error-messages.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/auth/error-messages.ts lib/auth/error-messages.test.ts && git commit -m "feat(auth): map supabase auth errors to friendly messages"
```

---

## Task 4: Route classification helper

**Files:**
- Create: `lib/auth/routes.ts`
- Create: `lib/auth/routes.test.ts`

**Interfaces:**
- Produces: `AUTH_PATHS: string[]`, `PROTECTED_PREFIXES: string[]`, `isAuthPath(pathname: string): boolean`, `isProtectedPath(pathname: string): boolean`. Consumed by `middleware.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `lib/auth/routes.test.ts`:
```ts
import { test, expect } from 'vitest';
import { isAuthPath, isProtectedPath } from './routes';

test('isProtectedPath matches the app area', () => {
  expect(isProtectedPath('/dashboard')).toBe(true);
  expect(isProtectedPath('/dashboard/anything')).toBe(true);
  expect(isProtectedPath('/login')).toBe(false);
  expect(isProtectedPath('/t/abc123')).toBe(false); // public trip page
});

test('isAuthPath matches only the auth screens', () => {
  expect(isAuthPath('/login')).toBe(true);
  expect(isAuthPath('/signup')).toBe(true);
  expect(isAuthPath('/forgot-password')).toBe(true);
  expect(isAuthPath('/reset-password')).toBe(true);
  expect(isAuthPath('/dashboard')).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/auth/routes.test.ts
```
Expected: FAIL — `./routes` cannot be resolved.

- [ ] **Step 3: Implement the helper**

Create `lib/auth/routes.ts`:
```ts
export const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'] as const;

export const PROTECTED_PREFIXES = ['/dashboard'] as const;

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd magnetrip-web && pnpm exec vitest run lib/auth/routes.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/auth/routes.ts lib/auth/routes.test.ts && git commit -m "feat(auth): add route classification helper for middleware"
```

---

## Task 5: Supabase browser client + middleware session util

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `getPublicEnv()` from `@/lib/env`.
- Produces:
  - `createBrowserSupabaseClient()` — a browser client (used by client components for auth actions).
  - `updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }>` — refreshes the session cookie and returns the current user. Consumed by `middleware.ts`.

- [ ] **Step 1: Implement the browser client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
```

- [ ] **Step 2: Implement the middleware session util**

Create `lib/supabase/middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase auth cookies for this request and returns the current user.
 * The returned response carries the refreshed cookies and MUST be returned from middleware
 * (after copying any redirect), or the session will not persist.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
```

- [ ] **Step 3: Typecheck**

Run:
```bash
cd magnetrip-web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add lib/supabase/client.ts lib/supabase/middleware.ts && git commit -m "feat(supabase): add browser client and middleware session refresh util"
```

---

## Task 6: Middleware — session refresh + route protection

**Files:**
- Create: `middleware.ts` (at `magnetrip-web/middleware.ts`)

**Interfaces:**
- Consumes: `updateSession` (Task 5), `isProtectedPath`/`isAuthPath` (Task 4).

- [ ] **Step 1: Implement the middleware**

Create `magnetrip-web/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAuthPath, isProtectedPath } from '@/lib/auth/routes';

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated users hitting a protected page → login (remember where they were going).
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting an auth screen → dashboard.
  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets; the callback route is
  // intentionally included so session cookies refresh there too.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 2: Verify build + that redirect responses preserve the refreshed cookies**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds (middleware compiles).

> Note for the implementer: the redirect branches above intentionally return a fresh `NextResponse.redirect` rather than `response`. That is acceptable here because an unauthenticated user has no session cookies to preserve, and an authenticated user being bounced off an auth page keeps their existing cookies (the redirect doesn't clear them). The pass-through `return response` is what preserves refreshed cookies for normal navigation.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add middleware.ts && git commit -m "feat(auth): add middleware for session refresh and route protection"
```

---

## Task 7: Auth shell + auth route-group layout

**Files:**
- Create: `components/auth/auth-shell.tsx`
- Create: `app/(auth)/layout.tsx`

**Interfaces:**
- Produces: `<AuthShell title subtitle>{children}</AuthShell>` — a centered card with the Magnetrip wordmark, used by all four auth pages. `app/(auth)/layout.tsx` centers content on the page background.

- [ ] **Step 1: Implement the auth shell**

Create `components/auth/auth-shell.tsx`:
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <div className="text-lg font-extrabold tracking-tight text-primary">Magnetrip</div>
        <CardTitle className="text-xl">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the auth layout**

Create `app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add components/auth/auth-shell.tsx "app/(auth)/layout.tsx" && git commit -m "feat(auth): add auth shell and centered auth layout"
```

---

## Task 8: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient` (Task 5), `loginSchema` (Task 2), `authErrorMessage` (Task 3), `AuthShell` (Task 7), shadcn `Button`/`Input`/`Label`, `sonner` `toast`, `lucide-react` `Loader2`.

- [ ] **Step 1: Implement the login page**

Create `app/(auth)/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    if (authError) {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your trips">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="text-primary hover:underline">Create one</Link>
        </p>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add "app/(auth)/login/page.tsx" && git commit -m "feat(auth): add login page"
```

---

## Task 9: Signup page

**Files:**
- Create: `app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient`, `signupSchema`, `authErrorMessage`, `AuthShell`, `getPublicEnv` (for `emailRedirectTo`), shadcn UI, `lucide-react`.

- [ ] **Step 1: Implement the signup page**

Create `app/(auth)/signup/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { signupSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { getPublicEnv } from '@/lib/env';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signupSchema.safeParse({ email, password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${getPublicEnv().siteUrl}/auth/callback?next=/dashboard` },
    });
    if (authError) {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    if (data.session) {
      router.replace('/dashboard');
      router.refresh();
      return;
    }
    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${email}.`}>
        <p className="text-sm text-muted-foreground">
          Click the link in that email to activate your account, then sign in.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start collecting your trips">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create account'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add "app/(auth)/signup/page.tsx" && git commit -m "feat(auth): add signup page with email-confirmation handling"
```

---

## Task 10: Forgot-password page

**Files:**
- Create: `app/(auth)/forgot-password/page.tsx`

**Interfaces:**
- Consumes: `createBrowserSupabaseClient`, `forgotPasswordSchema`, `authErrorMessage`, `getPublicEnv`, `AuthShell`, shadcn UI.

- [ ] **Step 1: Implement the forgot-password page**

Create `app/(auth)/forgot-password/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { getPublicEnv } from '@/lib/env';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${getPublicEnv().siteUrl}/auth/callback?next=/reset-password`,
    });
    // Always show a neutral confirmation to avoid leaking which emails exist.
    if (authError && authError.code === 'over_email_send_rate_limit') {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If an account exists, we sent a reset link.">
        <Link href="/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a reset link">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Send reset link'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add "app/(auth)/forgot-password/page.tsx" && git commit -m "feat(auth): add forgot-password page"
```

---

## Task 11: Auth callback route + reset-password page

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Phase 1, `@/lib/supabase/server`), `createBrowserSupabaseClient`, `resetPasswordSchema`, `authErrorMessage`, `AuthShell`, shadcn UI.
- Produces: `/auth/callback` exchanges the PKCE `code` for a session cookie, then redirects to `next`.

- [ ] **Step 1: Implement the callback route**

Create `app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  // Bad or missing code (expired link, etc.) → send to login with a flag.
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
```

- [ ] **Step 2: Implement the reset-password page**

Create `app/(auth)/reset-password/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The /auth/callback route already exchanged the code and set the recovery session cookie.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setValidSession(Boolean(data.session));
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (authError) {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  if (!ready) {
    return (
      <AuthShell title="Reset password">
        <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </AuthShell>
    );
  }

  if (!validSession) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add app/auth/callback/route.ts "app/(auth)/reset-password/page.tsx" && git commit -m "feat(auth): add auth callback route and reset-password page"
```

---

## Task 12: Protected dashboard stub, sign-out, and root redirect

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/dashboard/page.tsx`
- Create: `components/auth/sign-out-button.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (Phase 1), `createBrowserSupabaseClient`, shadcn `Button`.
- Produces: a working authenticated area proving the full flow. Phase 2c replaces the dashboard body.

- [ ] **Step 1: Implement the sign-out button**

Create `components/auth/sign-out-button.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={loading}>
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
```

- [ ] **Step 2: Implement the authenticated layout**

Create `app/(app)/layout.tsx`:
```tsx
import { SignOutButton } from '@/components/auth/sign-out-button';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-extrabold tracking-tight text-primary">Magnetrip</span>
        <SignOutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Implement the dashboard stub**

Create `app/(app)/dashboard/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route; this is a defensive backstop.
  if (!user) redirect('/login');

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Your trips</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email}. Your trips will appear here.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Redirect the root to the dashboard**

Replace the contents of `app/page.tsx` with:
```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  // Middleware redirects unauthenticated users to /login.
  redirect('/dashboard');
}
```

- [ ] **Step 5: Verify build**

Run:
```bash
cd magnetrip-web && pnpm build
```
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd magnetrip-web && git add "app/(app)/layout.tsx" "app/(app)/dashboard/page.tsx" components/auth/sign-out-button.tsx app/page.tsx && git commit -m "feat(auth): add protected dashboard stub, sign-out, and root redirect"
```

---

## Manual verification (end-to-end, after Task 12)

Unit tests cover the schemas, error mapper, and route helper. The auth flow itself must be verified against the live Supabase project (no component/e2e harness in this phase). Run `pnpm dev` and confirm:

1. Visit `/dashboard` while signed out → redirected to `/login?next=/dashboard`.
2. `/signup` → create an account. If email confirmation is ON → "Check your email" screen; click the emailed link → lands authenticated on `/dashboard`. If OFF → straight to `/dashboard`.
3. Sign out → redirected to `/login`; visiting `/dashboard` again redirects to `/login`.
4. `/login` with correct credentials → `/dashboard`; with wrong password → "Incorrect email or password." (no raw error).
5. While signed in, visit `/login` → redirected to `/dashboard`.
6. `/forgot-password` → enter email → neutral "check your email"; click the emailed link → `/reset-password` shows the form (not "Link expired") → set a new password → `/dashboard`.
7. Open `/reset-password` directly without a recovery session → "Link expired".

Record the results (and confirm the Supabase redirect-URL dashboard config from the top of this plan is in place) in the task report.

## Definition of Done (Phase 2a)

- `pnpm test` passes (auth schemas, error mapper, route helper).
- `pnpm build` succeeds; `tsc --noEmit` clean.
- Middleware protects `/dashboard`, refreshes sessions, and bounces signed-in users off auth pages.
- All four auth screens work end-to-end (manual checklist above), including email-confirm and password-reset via `/auth/callback`.
- App font is Plus Jakarta Sans. No data/API access was added (that's Phase 2b).

## Follow-up plans (not this phase)

- **Phase 2b — Data layer:** `lib/services/*` (trips/images business logic on a user-scoped client) + `app/api/*` route handlers (auth resolver for cookie OR bearer, Zod validation, error mapping) + typed `api-client`. Includes the deferred `trip_images` UPDATE RLS policy (needed for reorder) and `cover_image_id` same-trip validation.
- **Phase 2c — Dashboard & trip editor UI:** real dashboard cards (cover, name, year, description preview, Edit/Delete/Public-page/Copy-link) + trip editor (fields + image manager: multi-upload, drag-reorder, delete, set cover), consuming the api-client. Add chart/sidebar design tokens before wiring any shadcn sidebar/chart component (Phase 1 deferred item).
