# Magnetrip Web (Next.js) — Contributor Guide

## Overview
Next.js 16 / React 19 web app for Magnetrip. Owns the shared HTTP API + service layer,
the design-token pipeline, and public trip pages. Backend is Supabase (Auth, Postgres,
Storage, RLS). See `docs/superpowers/specs/2026-07-02-magnetrip-design.md`.

## Folder structure
- `app/` — routes. `(auth)/*` login/signup/forgot/reset; `(app)/*` authed dashboard + editor;
  `t/[publicId]` public page; `api/*` the HTTP API (the ONLY Supabase-data boundary).
- `lib/services/*` — business logic; the only code that touches Supabase data.
- `lib/api/*` — route helpers (auth resolution, validation, error mapping).
- `lib/api-client/*` — typed fetch wrapper the frontend uses to call `/api/*`.
- `lib/supabase/*` — `server.ts` (cookie client), `user-client.ts` (bearer client).
- `lib/types/*`, `lib/validation/*` — shared DTOs + Zod schemas.
- `design/tokens.json` + `scripts/generate-tokens.mjs` — design tokens → CSS + Flutter theme.
- `supabase/migrations/*` — checked-in SQL; apply via Supabase MCP or SQL Editor.

## Conventions
- **Data access:** pages/components NEVER import `supabase-js` for data — call `/api/*`.
  Auth/session via the Supabase SDK is allowed.
- **Types:** TypeScript strict. DTOs live in `lib/types`; validate all input with Zod.
- **API:** thin route handlers → services → user-scoped Supabase client (RLS enforces ownership).
- **State:** Server Components by default; client components only where interactivity requires.
- **Errors:** services throw typed errors → handlers map to HTTP → UI shows `sonner` toasts + inline errors.
- **Design system:** never hardcode colors/spacing — use tokens. To change them, edit
  `design/tokens.json` then run `pnpm tokens` (regenerates `app/tokens.generated.css` AND the Flutter theme).
- **Icons:** `lucide-react`.
- **Naming:** files kebab-case; React components PascalCase; functions camelCase.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Branch off `feat/magnetrip-mvp`.

## Commands
- `pnpm dev` · `pnpm build` · `pnpm test` (Vitest) · `pnpm tokens` (regenerate theme).

## Database conventions
- snake_case columns; every user-owned table has RLS owner-only policies.
- Public data is exposed ONLY via `SECURITY DEFINER` functions (e.g. `get_public_trip`), never
  by opening base-table policies to `anon`.
