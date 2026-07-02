# Magnetrip — Design Specification

**Date:** 2026-07-02
**Status:** Approved (design phase)
**Scope:** A two-client travel product — a Next.js web app and a Flutter mobile app — sharing one Supabase backend, one auth system, one design language, and one HTTP API layer.

A **Magnet** is a travel trip. On the web, owners manage rich trips (images, description, public page). On mobile, owners manage NFC tags that point to each trip's public page. Anyone can view a trip's public page with no login.

---

## 1. Product Summary

| Client | Purpose | Primary user |
|---|---|---|
| **Web (Next.js)** | Full trip management: dashboard, editor, image galleries, public pages | Trip owner (desktop/tablet/mobile browser) |
| **Mobile (Flutter)** | Lightweight trip list + NFC tag writing/relinking | Trip owner (physical phone) |
| **Public page** | Read-only trip view opened by scanning an NFC tag | Anonymous visitor |

**End-to-end flow:** owner creates a trip → gets a public URL → writes that URL to an NFC tag (mobile) → a visitor taps the tag → phone opens the public page → no login required.

---

## 2. Constraints & Decisions (locked)

- **Backend:** Supabase (Auth, Postgres, Storage, RLS). Env vars already present in `magnetrip-web/.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Connect only; do not recreate the project.
- **API layer:** A single HTTP API lives in `magnetrip-web/app/api/*`. **Both** clients consume it — the web frontend and Flutter. **No page, component, or screen touches `supabase-js` for data.** Only the service layer behind the API routes talks to Supabase. (Exception: **auth/session** uses the Supabase SDK directly on both clients — that is login, not data.)
- **Mobile → backend:** Flutter calls the Next.js REST API over HTTP with the user's Supabase JWT as a `Bearer` token.
- **Auth:** Email + password (Supabase Auth) on both clients.
- **Public URL:** short opaque id, `/{PUBLIC_SITE_URL}/t/{public_id}`. Stable for the life of the trip; safe to write to NFC once. This exact string is what gets written to the tag.
- **Theme:** light only.
- **Deployment:** web app deploys to **Vercel** (needed early so NFC + public pages resolve to a real HTTPS domain).
- **Repository layout:** write **only** inside `magnetrip/` and `magnetrip-web/`. Nothing at the repo root.
- **Version control:** neither app is a git repo today. Committing is out of scope until the user initializes git.

---

## 3. Design System

Single source of truth: **`magnetrip-web/design/tokens.json`**. A Node generator (`magnetrip-web/scripts/generate-tokens.mjs`) reads it and emits:
1. Web CSS variables into `magnetrip-web/app/globals.css` (consumed by Tailwind v4 `@theme` + shadcn).
2. A Dart theme file into `magnetrip/lib/theme/app_theme.dart` (a `ThemeData` + a `MagnetripColors`/`MagnetripSpacing` set).

Run the generator whenever tokens change. Documented in both `CLAUDE.md` files. This keeps the two apps visually identical with zero manual drift.

### 3.1 Color palette — "Expedition" (light)

| Role | Hex | Notes |
|---|---|---|
| Primary | `#0D9488` | teal; primary buttons, links, active states. Foreground `#FFFFFF` |
| Secondary | `#44403C` | warm stone; secondary text/buttons. Foreground `#FFFFFF` |
| Accent | `#E07A5F` | clay; highlights, selected, small emphasis. Foreground `#FFFFFF` |
| Background | `#FAF9F6` | warm off-white app canvas |
| Surface / Card | `#FFFFFF` | cards, sheets, inputs |
| Border | `#E7E2D9` | dividers, card/input borders |
| Success | `#15803D` | text `#15803D`, bg tint `#DCFCE7` |
| Warning | `#B45309` | text; icon/fill `#D97706` |
| Error / Destructive | `#DC2626` | text `#DC2626`, bg tint `#FEE2E2` |
| Text primary | `#1C1917` | headings/body (16:1) |
| Text secondary | `#57534E` | subtitles/helper (7:1) |
| Text muted | `#78716C` | captions, year, timestamps (4.7:1) |
| Disabled / faint | `#A8A29E` | **borders & disabled only — never text** |

All text roles pass WCAG AA on white/`#FAF9F6`. `#A8A29E` fails as text and is reserved for non-text use.

### 3.2 Typography

- **Family:** Plus Jakarta Sans, all weights. Web via `next/font/google`; Flutter via `google_fonts`.
- **Scale:** Display 32 · H1 28 · H2 22 · H3 18 · Body 16 · Small 14 · Caption 12.
- **Weights:** 400 / 500 / 600 / 700 / 800. Headings 700–800, body 400–500, labels 600.
- **Line height:** headings ~1.15, body ~1.6.

### 3.3 Spacing, radius, shadow

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Radius:** sm 8 · md 12 (base) · lg 16 · xl 20 · 2xl 24 · full 9999.
- **Elevation (warm-tinted, `rgba(28,25,23,α)`):**
  - `sm` — `0 1px 2px rgba(28,25,23,.05)`
  - `md` — `0 1px 2px rgba(28,25,23,.04), 0 8px 24px rgba(28,25,23,.05)` (cards)
  - `lg` — `0 12px 32px rgba(28,25,23,.12)` (overlays, dialogs, hover)

### 3.4 Icons

Lucide on both platforms: `lucide-react` (web, already installed) and `lucide_icons` (Flutter).

### 3.5 UI components

- **Web:** shadcn/ui (already scaffolded in `components/ui`, style `base-vega`). Follow shadcn conventions; theme via the generated CSS variables.
- **Flutter:** hand-built widgets that visually match the shadcn components (buttons, inputs, cards, dialogs, badges, sheets, toasts) using the generated theme, so both apps feel like one product.

---

## 4. Architecture

### 4.1 Repository layout

```
magnetrip-web/                 # Next.js — owns the API + service layer
  app/
    (auth)/login/
    (app)/dashboard/
    (app)/trips/[id]/edit/
    t/[publicId]/              # public page, no auth
    api/                       # the single HTTP API (both clients call this)
  lib/
    services/                  # business logic; ONLY layer that touches Supabase data
    supabase/                  # server + admin client factories, session helpers
    api/                       # route helpers: auth resolution, validation, error mapping
    api-client/                # typed fetch wrapper the web frontend uses to call /api/*
    types/                     # shared TS contracts (DTOs)
    validation/                # Zod schemas
  components/                  # feature components + ui (shadcn)
  design/tokens.json
  scripts/generate-tokens.mjs
  docs/superpowers/specs/
  CLAUDE.md

magnetrip/                     # Flutter — Riverpod, consumes the REST API
  lib/
    core/                      # config, api client (dio + auth interceptor), errors, router
    theme/app_theme.dart       # GENERATED from tokens.json
    features/
      auth/
      trips/
      nfc/
    main.dart
  CLAUDE.md
```

### 4.2 Request flow

```
Web frontend  ──fetch──▶  /api/*  ──▶  lib/services/*  ──▶  Supabase (RLS)
Flutter       ──dio────▶  /api/*  ──▶  lib/services/*  ──▶  Supabase (RLS)
Public page   ──fetch──▶  /api/public/trips/:id  ──▶  services  ──▶  get_public_trip() RPC
```

- **Business logic lives once** in `lib/services/*` — pure functions that receive a user-scoped Supabase client and typed inputs, and return typed DTOs. They never build HTTP responses.
- **Route handlers** in `app/api/*` are thin: resolve the caller, validate input (Zod), call a service, map results/errors to HTTP.
- **Web frontend** never imports services or `supabase-js` for data; it calls `/api/*` through the typed `api-client`.

### 4.3 Auth resolution in the API

Each protected route resolves the current user from **either**:
- a **Supabase session cookie** (web, via `@supabase/ssr`), or
- an **`Authorization: Bearer <jwt>`** header (Flutter).

From the resolved token the handler builds a **user-scoped Supabase client** (the user's JWT attached), so **Postgres RLS enforces ownership** on every query. No service-role key is used on the request path. (A service-role/admin client exists only for the `SECURITY DEFINER` public function and any future privileged jobs.)

---

## 5. Data Model (Supabase / Postgres)

### `trips`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid | → `auth.users`, not null |
| `name` | text | not null |
| `year` | int | nullable |
| `description` | text | nullable |
| `public_id` | text | unique, not null — short unguessable id (e.g. 10-char nanoid); used in the public URL |
| `cover_image_id` | uuid | nullable → `trip_images.id` |
| `nfc_tag_id` | text | nullable — tag UID captured on link (informational) |
| `nfc_linked_at` | timestamptz | nullable |
| `created_at` / `updated_at` | timestamptz | defaults; `updated_at` via trigger |

### `trip_images`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `trip_id` | uuid | → `trips`, on delete cascade |
| `storage_path` | text | path in the `trip-images` bucket |
| `position` | int | ordering, not null default 0 |
| `width` / `height` | int | nullable (for layout) |
| `created_at` | timestamptz | |

Cover image = `trips.cover_image_id`, falling back to the lowest-`position` image.

### Storage

- Bucket **`trip-images`**, **public read** (public pages need the images).
- Object path: `{user_id}/{trip_id}/{uuid}.{ext}`.
- Write/delete restricted by storage RLS to the owning `user_id` prefix.

### Row-Level Security

- `trips`, `trip_images`: `select/insert/update/delete` allowed only where the row belongs to `auth.uid()` (images via join to their trip).
- **Public read** is *not* granted on the base tables. Instead a `SECURITY DEFINER` function:
  ```
  get_public_trip(p_public_id text) returns json
  -- returns ONLY { name, year, description, images:[{url, position}] }
  -- for the matching public_id; nothing else, no owner data
  ```
  `execute` granted to the `anon` role. This is the only anonymous data path.

---

## 6. API Surface

All under `magnetrip-web/app/api`. JSON in/out, Zod-validated, typed DTOs shared via `lib/types`.

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/trips` | user | list caller's trips (with cover) |
| `POST /api/trips` | user | create trip (name required) → returns trip incl. `public_id` |
| `GET /api/trips/:id` | user | trip detail + images |
| `PATCH /api/trips/:id` | user | update name/year/description/cover |
| `DELETE /api/trips/:id` | user | delete trip (cascades images + storage cleanup) |
| `POST /api/uploads/sign` | user | signed upload URL for direct-to-Storage upload (web) |
| `POST /api/trips/:id/images` | user | register uploaded image (path, position) |
| `PATCH /api/trips/:id/images/reorder` | user | persist new ordering |
| `DELETE /api/images/:id` | user | delete one image (+ storage object) |
| `PATCH /api/trips/:id/nfc` | user | record `nfc_tag_id` + `nfc_linked_at` after a successful write |
| `GET /api/public/trips/:publicId` | none | public page data via `get_public_trip` |

**Image upload flow (web):** `POST /api/uploads/sign` → client uploads the file straight to Storage with the signed URL → `POST /api/trips/:id/images` to register it. Supports multiple files, drag-to-reorder, and delete.

---

## 7. Web App (Next.js)

- **`(auth)/login`** — email+password form; validation, loading, auth-error messaging; redirect to dashboard on success. Middleware guards `(app)/*` and redirects unauthenticated users here.
- **`(app)/dashboard`** — grid of trip cards. Each card: cover image (or gradient placeholder), name, year, description preview, and actions: **Edit**, **Delete** (confirm dialog), **Show public page** (opens `/t/:publicId`), **Copy public link** (toast confirm).
- **`(app)/trips/[id]/edit`** — edit name, year, description; image manager (upload multiple, drag-reorder, delete, set cover); save with optimistic feedback.
- **`t/[publicId]`** — public, no auth. Polished responsive gallery: name, year, description, image gallery (lazy-loaded, optimized). Handles "trip not found" gracefully.
- **Responsive:** desktop / tablet / mobile browser. Cards reflow; editor and gallery adapt.

---

## 8. Flutter App (mobile)

Feature-first + **Riverpod** (repos and controllers as providers; `AsyncValue` drives loading/error/data). `go_router` for navigation, `dio` for HTTP with an auth interceptor that injects the current Supabase JWT and refreshes it. Theme generated from `tokens.json`.

- **Login** — email+password via `supabase_flutter`; on success the session token is used for all API calls.
- **Trip list** — the caller's trips, **name only** (per spec). Pull-to-refresh. Per-item actions: **Rename**, **Delete**, **Relink NFC**.
- **Create trip** — Step 1: enter name → Step 2: press **Create** (POST `/api/trips`) → Step 3: **immediately** start NFC linking: scan a tag, write the trip's public URL, show success/failure. On success, `PATCH /api/trips/:id/nfc` records the tag.
- **Relink NFC** — scan a tag and overwrite it with the latest public URL; confirm success.

### NFC

- Package: **`nfc_manager`**. Write the public URL as an **NDEF URI record** so tapping the tag auto-opens the phone browser to the public page.
- Distinct handling for: NFC **unavailable** (no hardware/off), **permission denied**, **write failed**, **scan timeout/cancelled**, **tag not writable/locked**.
- ⚠️ **Physical device required.** iOS needs the **Core NFC** entitlement and a **paid Apple Developer account** to run on-device; Android needs the NFC permission in the manifest. NFC cannot be tested on simulators/emulators.

---

## 9. Error, Loading & Empty States

**Errors — shared taxonomy** (typed, mapped consistently):
network failure · auth failure/expired session · validation error · not found · unauthorized · upload failure · NFC unavailable · NFC permission denied · NFC write failure · invalid/locked tag.

- **Web:** services throw typed errors → route handlers map to HTTP status → `api-client` normalizes → UI shows `sonner` toasts + inline field errors. Never leak raw errors.
- **Flutter:** `dio` errors → typed failures → `AsyncValue.error` → friendly message + **Retry**; NFC errors get specific copy.

**Loading:** web uses skeletons (`skeleton.tsx`) + Suspense for dashboard/editor/public page and spinners for actions (save, upload, login); Flutter uses shimmer/skeleton lists and button spinners (login, list, saving, NFC writing). Never block the whole UI for a local action.

**Empty states:** "No trips yet" → friendly message + **Create trip** CTA (the design you approved). "No images" → placeholder. "No internet" → explanation + **Retry**.

---

## 10. Documentation (`CLAUDE.md` × 2)

No root `CLAUDE.md`. Each app gets its own, tuned to that stack, covering: overview, folder structure, coding conventions, architecture decisions, naming, state management, error handling, component guidelines, API conventions, database conventions, commit conventions, and guidance for future AI sessions. Both reference the shared design system and the token-generation workflow.

---

## 11. Non-Functional Requirements

- **Performance:** lazy-load + size-optimize images, cache public pages, minimize re-renders, keep bundles reasonable.
- **Security:** RLS is the backstop for all owner data; public data only via `get_public_trip`; validate all input (Zod on web, model validation on Flutter); never expose owner identity on public pages.
- **Maintainability:** TypeScript strict mode; strong typing on both sides; feature-first modules; repository/service separation; no duplicated business logic; composition over duplication; consistent naming.
- **Consistency:** identical design tokens, matching components, and equivalent behavior across web and mobile.

---

## 12. Implementation Phasing

One spec, built in five sequenced milestones (detailed by the planning phase):

1. **Foundation** — connect Supabase; schema + RLS + storage bucket + `get_public_trip`; `tokens.json` + generator (emits web CSS vars + Flutter theme); shared TS types/Zod; both `CLAUDE.md` files.
2. **Web core** — auth + middleware; service layer + API routes for trips/images; `api-client`; dashboard; trip editor (upload/reorder/delete/cover).
3. **Public page + Vercel deploy** — `t/[publicId]` + public API/RPC; deploy so a real HTTPS base URL exists for NFC.
4. **Flutter foundation** — theme from tokens; config/env base URL; `dio` client + auth interceptor; login; trip list + create/rename/delete against the API.
5. **Flutter NFC** — create-trip → immediate write flow; relink; full NFC error handling.

Each milestone is independently verifiable and leaves the product in a working state.

---

## 13. Open Items / Risks

- **NFC testing** requires a physical phone (and, for iOS on-device, a paid Apple Developer account). Confirm availability before Phase 5.
- **Vercel domain** must exist before NFC tags are written with production URLs (Phase 3). Until then, use an env-driven base URL (`NEXT_PUBLIC_SITE_URL` / Flutter `--dart-define=API_BASE_URL`).
- **Git** is not initialized in either app; version control + commit conventions apply only once the user sets it up.
