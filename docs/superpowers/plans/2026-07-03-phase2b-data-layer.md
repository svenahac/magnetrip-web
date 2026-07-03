# Magnetrip Phase 2b — Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the trips/images data vertical: a Supabase-touching service layer, thin `app/api/*` route handlers that expose it over HTTP (auth via cookie OR bearer JWT, Zod-validated, typed errors → HTTP), and a typed `api-client` the web frontend (and later Flutter, over HTTP) uses — so the dashboard and editor (Phase 2c) have a complete, tested data API.

**Architecture:** Business logic lives once in `lib/services/*` (pure-ish functions that take a user-scoped Supabase client + typed inputs, return DTOs, and throw a typed `ServiceError`; RLS enforces ownership). `app/api/*` handlers resolve the caller (cookie session for web, `Authorization: Bearer` for Flutter), validate input, call a service, and map results/errors to HTTP via a shared wrapper. `lib/api-client/*` is a typed `fetch` wrapper the web frontend calls same-origin with credentials. Row→DTO mapping, URL building, error→HTTP translation, request parsing, and the api-client are unit-tested (TDD); the DB-touching services + routes are verified by a controller-run integration pass against the live Supabase project.

**Tech Stack:** Next.js 16 route handlers, TypeScript strict, `@supabase/supabase-js` + `@supabase/ssr`, Zod, Vitest. Supabase Postgres/Storage with the Phase 1 schema + RLS.

## Global Constraints

- Write only inside `magnetrip-web/` (except SQL applied to Supabase via MCP, kept as checked-in migration files).
- **This is the ONLY layer that touches Supabase data.** Pages/components never import `supabase-js` for data — they call `app/api/*` via the `api-client`. (Auth/session SDK use stays in the Phase 2a auth code.)
- TypeScript strict; pnpm; Vitest (`include: **/*.test.{ts,tsx,mjs}`, node env). Conventional Commits on branch `feat/magnetrip-mvp`.
- Reuse from earlier phases: DTO types + input types (`lib/types/trip.ts`), Zod schemas (`lib/validation/trip.ts`: `createTripSchema`, `updateTripSchema`, `registerImageSchema`, `reorderImagesSchema`, `linkNfcSchema`), `createServerSupabaseClient()` (`lib/supabase/server.ts`, cookie session), `createUserSupabaseClient(accessToken)` (`lib/supabase/user-client.ts`, bearer), `getPublicEnv()` (`lib/env.ts`).
- DB is snake_case; DTOs are camelCase — services map between them. Public image URL = `${supabaseUrl}/storage/v1/object/public/trip-images/${storage_path}`.
- Storage object path convention (matches Phase 1 owner-write RLS `(storage.foldername(name))[1] = auth.uid()`): `{userId}/{tripId}/{uuid}.{ext}`.
- Ownership is enforced by Postgres RLS (owner-only policies from Phase 1); services must not use a service-role client. A mutation that affects 0 rows because RLS hid the row is reported as `not_found` (don't leak existence).
- Folds in two deferred items from the Phase 1/2a reviews: the missing `trip_images` UPDATE RLS policy (Task 1) and `cover_image_id` same-trip validation (enforced in `updateTrip`, Task 3).
- Phase 2c note (not this plan): before adding authed routes outside `/dashboard`, extend `PROTECTED_PREFIXES`.

## Testing approach (read before starting)

- **Unit-TDD (subagent-run, Vitest):** mappers/URL builder, error→HTTP map, bearer-token extraction, request body parsing, and the `api-client` (with `global.fetch` stubbed). These hold the mapping/contract/error logic where bugs hide.
- **Integration verification (controller-run, Task 10):** the DB-touching services + routes are exercised against the live Supabase project using a seeded bcrypt test user (created via MCP). Subagents do not run this; the controller does. Services/routes are otherwise verified by `tsc --noEmit` + `pnpm build`.

---

## File Structure

- `supabase/migrations/0005_trip_images_update_policy.sql` — trip_images UPDATE RLS policy (for reorder).
- `lib/services/errors.ts` — `ServiceError`, `ServiceErrorKind`, `httpStatusForKind`.
- `lib/services/mappers.ts` — `publicImageUrl`, `mapImageRow`, `pickCover`, `mapTripListItem`, `mapTripRow`.
- `lib/services/mappers.test.ts`, `lib/services/errors.test.ts`.
- `lib/services/trips.service.ts` — `listTrips`, `getTrip`, `createTrip`, `updateTrip`, `deleteTrip`.
- `lib/services/images.service.ts` — `createSignedUpload`, `registerImage`, `reorderImages`, `deleteImage`.
- `lib/services/nfc.service.ts` — `linkNfc`.
- `lib/services/public.service.ts` — `getPublicTrip`.
- `lib/api/errors.ts` — `extractBearerToken`, `toHttpError` (ServiceError/ZodError → { status, message }).
- `lib/api/errors.test.ts`.
- `lib/api/auth.ts` — `resolveApiContext(request)` → `{ supabase, userId }`.
- `lib/api/route.ts` — `route(handler)` wrapper (JSON + error mapping); `parseBody(request, schema)`.
- `lib/api/route.test.ts` — `parseBody` tests.
- `app/api/trips/route.ts` — GET (list), POST (create).
- `app/api/trips/[id]/route.ts` — GET, PATCH, DELETE.
- `app/api/trips/[id]/images/route.ts` — POST (register).
- `app/api/trips/[id]/images/reorder/route.ts` — PATCH.
- `app/api/trips/[id]/nfc/route.ts` — PATCH.
- `app/api/images/[id]/route.ts` — DELETE.
- `app/api/uploads/sign/route.ts` — POST (signed upload URL).
- `app/api/public/trips/[publicId]/route.ts` — GET (no auth).
- `lib/api-client/index.ts` — typed fetch wrapper + `ApiError`.
- `lib/api-client/index.test.ts` — with stubbed `global.fetch`.
- `scripts/integration/phase2b.mjs` — controller-run integration exercise (Task 10).

---

## Task 1: trip_images UPDATE RLS policy

**Files:**
- Create: `supabase/migrations/0005_trip_images_update_policy.sql`

**Interfaces:** Produces an owner-scoped UPDATE policy on `trip_images` so `reorderImages` (Task 4) can persist `position` changes.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_trip_images_update_policy.sql`:
```sql
-- Phase 2b — allow owners to UPDATE their trip images (needed for reorder).
drop policy if exists trip_images_update_own on public.trip_images;
create policy trip_images_update_own on public.trip_images
  for update using (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()))
  with check (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()));
```

- [ ] **Step 2: Apply + verify (controller / MCP)**

Apply via Supabase MCP `apply_migration` (name `0005_trip_images_update_policy`) or the SQL Editor. Then verify:
```sql
select count(*) as update_policy from pg_policies
where schemaname='public' and tablename='trip_images' and policyname='trip_images_update_own';
```
Expected: `update_policy = 1`.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add supabase/migrations/0005_trip_images_update_policy.sql && git commit -m "feat(db): add owner UPDATE policy on trip_images for reorder"
```

---

## Task 2: Service errors + row→DTO mappers

**Files:**
- Create: `lib/services/errors.ts`, `lib/services/errors.test.ts`
- Create: `lib/services/mappers.ts`, `lib/services/mappers.test.ts`

**Interfaces:**
- Produces:
  - `ServiceError` (class, `kind: ServiceErrorKind`, `message`), `ServiceErrorKind = 'unauthorized'|'forbidden'|'not_found'|'validation'|'conflict'|'internal'`, `httpStatusForKind: Record<ServiceErrorKind, number>`.
  - `publicImageUrl(storagePath): string`, `mapImageRow(row): TripImage`, `pickCover(coverImageId, rows): ImageRow | null`, `mapTripListItem(row, imageRows): TripListItem`, `mapTripRow(row, imageRows): Trip`. Exported row types `TripRow`, `ImageRow`.

- [ ] **Step 1: Write the failing tests**

Create `lib/services/errors.test.ts`:
```ts
import { test, expect } from 'vitest';
import { ServiceError, httpStatusForKind } from './errors';

test('ServiceError carries kind and message', () => {
  const e = new ServiceError('not_found', 'Trip not found');
  expect(e.kind).toBe('not_found');
  expect(e.message).toBe('Trip not found');
  expect(e instanceof Error).toBe(true);
});

test('httpStatusForKind maps every kind', () => {
  expect(httpStatusForKind.unauthorized).toBe(401);
  expect(httpStatusForKind.forbidden).toBe(403);
  expect(httpStatusForKind.not_found).toBe(404);
  expect(httpStatusForKind.validation).toBe(400);
  expect(httpStatusForKind.conflict).toBe(409);
  expect(httpStatusForKind.internal).toBe(500);
});
```

Create `lib/services/mappers.test.ts`:
```ts
import { test, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
});

const { publicImageUrl, mapImageRow, pickCover, mapTripListItem, mapTripRow } = await import('./mappers');

const imageRow = (over = {}) => ({ id: 'i1', trip_id: 't1', storage_path: 'u1/t1/a.jpg', position: 0, width: null, height: null, ...over });
const tripRow = (over = {}) => ({ id: 't1', user_id: 'u1', name: 'Trip', year: 2024, description: 'd', public_id: 'p1', cover_image_id: null, nfc_tag_id: null, nfc_linked_at: null, created_at: 'c', updated_at: 'u', ...over });

test('publicImageUrl builds the Supabase public object URL', () => {
  expect(publicImageUrl('u1/t1/a.jpg')).toBe('https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/a.jpg');
});

test('mapImageRow converts snake_case row to camelCase DTO with url', () => {
  const dto = mapImageRow(imageRow({ position: 3, width: 800 }));
  expect(dto).toEqual({ id: 'i1', tripId: 't1', storagePath: 'u1/t1/a.jpg', url: 'https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/a.jpg', position: 3, width: 800, height: null });
});

test('pickCover returns the explicit cover when present', () => {
  const rows = [imageRow({ id: 'a', position: 1 }), imageRow({ id: 'b', position: 0 })];
  expect(pickCover('a', rows)?.id).toBe('a');
});

test('pickCover falls back to the lowest position, and null when empty', () => {
  const rows = [imageRow({ id: 'a', position: 2 }), imageRow({ id: 'b', position: 1 })];
  expect(pickCover(null, rows)?.id).toBe('b');
  expect(pickCover('missing', rows)?.id).toBe('b'); // stale cover id → fallback
  expect(pickCover(null, [])).toBeNull();
});

test('mapTripListItem exposes coverUrl and omits owner fields', () => {
  const item = mapTripListItem(tripRow({ cover_image_id: 'a' }), [imageRow({ id: 'a', storage_path: 'u1/t1/cover.jpg', position: 0 })]);
  expect(item.coverUrl).toBe('https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/cover.jpg');
  expect(item).not.toHaveProperty('userId');
});

test('mapTripRow includes images sorted mapping and all fields', () => {
  const trip = mapTripRow(tripRow(), [imageRow()]);
  expect(trip.publicId).toBe('p1');
  expect(trip.images).toHaveLength(1);
  expect(trip.images[0].url).toContain('/trip-images/u1/t1/a.jpg');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd magnetrip-web && pnpm exec vitest run lib/services/errors.test.ts lib/services/mappers.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement errors + mappers**

Create `lib/services/errors.ts`:
```ts
export type ServiceErrorKind =
  | 'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'internal';

export class ServiceError extends Error {
  constructor(public readonly kind: ServiceErrorKind, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const httpStatusForKind: Record<ServiceErrorKind, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  internal: 500,
};
```

Create `lib/services/mappers.ts`:
```ts
import type { Trip, TripImage, TripListItem } from '@/lib/types/trip';
import { getPublicEnv } from '@/lib/env';

export interface ImageRow {
  id: string;
  trip_id: string;
  storage_path: string;
  position: number;
  width: number | null;
  height: number | null;
}

export interface TripRow {
  id: string;
  user_id: string;
  name: string;
  year: number | null;
  description: string | null;
  public_id: string;
  cover_image_id: string | null;
  nfc_tag_id: string | null;
  nfc_linked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function publicImageUrl(storagePath: string): string {
  const { supabaseUrl } = getPublicEnv();
  return `${supabaseUrl}/storage/v1/object/public/trip-images/${storagePath}`;
}

export function mapImageRow(row: ImageRow): TripImage {
  return {
    id: row.id,
    tripId: row.trip_id,
    storagePath: row.storage_path,
    url: publicImageUrl(row.storage_path),
    position: row.position,
    width: row.width,
    height: row.height,
  };
}

export function pickCover(coverImageId: string | null, rows: ImageRow[]): ImageRow | null {
  if (coverImageId) {
    const match = rows.find((r) => r.id === coverImageId);
    if (match) return match;
  }
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => a.position - b.position)[0];
}

export function mapTripListItem(row: TripRow, imageRows: ImageRow[]): TripListItem {
  const cover = pickCover(row.cover_image_id, imageRows);
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    description: row.description,
    publicId: row.public_id,
    coverUrl: cover ? publicImageUrl(cover.storage_path) : null,
    nfcLinkedAt: row.nfc_linked_at,
  };
}

export function mapTripRow(row: TripRow, imageRows: ImageRow[]): Trip {
  const images = [...imageRows].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    year: row.year,
    description: row.description,
    publicId: row.public_id,
    coverImageId: row.cover_image_id,
    nfcTagId: row.nfc_tag_id,
    nfcLinkedAt: row.nfc_linked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.map(mapImageRow),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd magnetrip-web && pnpm exec vitest run lib/services/errors.test.ts lib/services/mappers.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/services/errors.ts lib/services/errors.test.ts lib/services/mappers.ts lib/services/mappers.test.ts && git commit -m "feat(services): add ServiceError and row->DTO mappers"
```

---

## Task 3: Trips service

**Files:**
- Create: `lib/services/trips.service.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (a user-scoped client), `ServiceError`, mappers, DTO/input types.
- Produces: `listTrips(supabase): Promise<TripListItem[]>`, `getTrip(supabase, id): Promise<Trip>`, `createTrip(supabase, userId, input: CreateTripInput): Promise<Trip>`, `updateTrip(supabase, id, input: UpdateTripInput): Promise<Trip>`, `deleteTrip(supabase, id): Promise<void>`. Constants `TRIP_COLUMNS`, `IMAGE_COLUMNS` (exported for reuse).

- [ ] **Step 1: Implement the service**

Create `lib/services/trips.service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip, TripListItem, CreateTripInput, UpdateTripInput } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { mapTripRow, mapTripListItem, type ImageRow, type TripRow } from './mappers';

export const TRIP_COLUMNS =
  'id, user_id, name, year, description, public_id, cover_image_id, nfc_tag_id, nfc_linked_at, created_at, updated_at';
export const IMAGE_COLUMNS = 'id, trip_id, storage_path, position, width, height';

type TripWithImages = TripRow & { trip_images: ImageRow[] | null };

export async function listTrips(supabase: SupabaseClient): Promise<TripListItem[]> {
  const { data, error } = await supabase
    .from('trips')
    .select(`${TRIP_COLUMNS}, trip_images(${IMAGE_COLUMNS})`)
    .order('created_at', { ascending: false });
  if (error) throw new ServiceError('internal', error.message);
  return (data as TripWithImages[] | null ?? []).map((row) =>
    mapTripListItem(row, row.trip_images ?? []));
}

export async function getTrip(supabase: SupabaseClient, id: string): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .select(`${TRIP_COLUMNS}, trip_images(${IMAGE_COLUMNS})`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');
  const row = data as TripWithImages;
  return mapTripRow(row, row.trip_images ?? []);
}

export async function createTrip(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTripInput,
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: userId,
      name: input.name,
      year: input.year ?? null,
      description: input.description ?? null,
    })
    .select(TRIP_COLUMNS)
    .single();
  if (error) throw new ServiceError('internal', error.message);
  return mapTripRow(data as TripRow, []);
}

export async function updateTrip(
  supabase: SupabaseClient,
  id: string,
  input: UpdateTripInput,
): Promise<Trip> {
  // Enforce that a chosen cover image belongs to THIS trip (RLS also scopes to the owner).
  if (input.coverImageId) {
    const { data: img, error: imgErr } = await supabase
      .from('trip_images')
      .select('id')
      .eq('id', input.coverImageId)
      .eq('trip_id', id)
      .maybeSingle();
    if (imgErr) throw new ServiceError('internal', imgErr.message);
    if (!img) throw new ServiceError('validation', 'Cover image does not belong to this trip');
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.year !== undefined) patch.year = input.year;
  if (input.description !== undefined) patch.description = input.description;
  if (input.coverImageId !== undefined) patch.cover_image_id = input.coverImageId;

  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from('trips')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw new ServiceError('internal', error.message);
    if (!data) throw new ServiceError('not_found', 'Trip not found');
  }
  return getTrip(supabase, id);
}

export async function deleteTrip(supabase: SupabaseClient, id: string): Promise<void> {
  // Collect storage paths first so we can clean up objects after the row cascade.
  const { data: images } = await supabase
    .from('trip_images')
    .select('storage_path')
    .eq('trip_id', id);

  const { data, error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');

  const paths = (images ?? []).map((r: { storage_path: string }) => r.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from('trip-images').remove(paths);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd magnetrip-web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add lib/services/trips.service.ts && git commit -m "feat(services): add trips service (list/get/create/update/delete)"
```

---

## Task 4: Images + NFC services

**Files:**
- Create: `lib/services/images.service.ts`
- Create: `lib/services/nfc.service.ts`

**Interfaces:**
- Produces:
  - `createSignedUpload(supabase, userId, tripId, ext): Promise<{ path: string; token: string; signedUrl: string }>`
  - `registerImage(supabase, tripId, input: RegisterImageInput): Promise<TripImage>`
  - `reorderImages(supabase, tripId, imageIds: string[]): Promise<void>`
  - `deleteImage(supabase, imageId): Promise<void>`
  - `linkNfc(supabase, tripId, input: LinkNfcInput): Promise<Trip>`

- [ ] **Step 1: Implement the images service**

Create `lib/services/images.service.ts`:
```ts
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripImage, RegisterImageInput } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { mapImageRow, type ImageRow } from './mappers';
import { IMAGE_COLUMNS } from './trips.service';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export async function createSignedUpload(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  ext: string,
): Promise<{ path: string; token: string; signedUrl: string }> {
  // RLS: this select returns a row only if the caller owns the trip.
  const { data: trip, error: tripErr } = await supabase
    .from('trips').select('id').eq('id', tripId).maybeSingle();
  if (tripErr) throw new ServiceError('internal', tripErr.message);
  if (!trip) throw new ServiceError('not_found', 'Trip not found');

  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = ALLOWED_EXT.has(clean) ? clean : 'jpg';
  const path = `${userId}/${tripId}/${randomUUID()}.${safeExt}`;

  const { data, error } = await supabase.storage.from('trip-images').createSignedUploadUrl(path);
  if (error || !data) throw new ServiceError('internal', error?.message ?? 'Failed to create upload URL');
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function registerImage(
  supabase: SupabaseClient,
  tripId: string,
  input: RegisterImageInput,
): Promise<TripImage> {
  // Ensure the storage path is namespaced under this trip (defense in depth alongside RLS).
  if (!input.storagePath.includes(`/${tripId}/`)) {
    throw new ServiceError('validation', 'Storage path does not belong to this trip');
  }
  const { data, error } = await supabase
    .from('trip_images')
    .insert({
      trip_id: tripId,
      storage_path: input.storagePath,
      position: input.position,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .select(IMAGE_COLUMNS)
    .single();
  if (error) throw new ServiceError('internal', error.message);
  return mapImageRow(data as ImageRow);
}

export async function reorderImages(
  supabase: SupabaseClient,
  tripId: string,
  imageIds: string[],
): Promise<void> {
  const { data: existing, error } = await supabase
    .from('trip_images').select('id').eq('trip_id', tripId);
  if (error) throw new ServiceError('internal', error.message);
  const owned = new Set((existing ?? []).map((r: { id: string }) => r.id));
  if (imageIds.length !== owned.size || !imageIds.every((id) => owned.has(id))) {
    throw new ServiceError('validation', 'Image list does not match this trip');
  }
  for (let i = 0; i < imageIds.length; i++) {
    const { error: upErr } = await supabase
      .from('trip_images').update({ position: i }).eq('id', imageIds[i]).eq('trip_id', tripId);
    if (upErr) throw new ServiceError('internal', upErr.message);
  }
}

export async function deleteImage(supabase: SupabaseClient, imageId: string): Promise<void> {
  const { data: img, error } = await supabase
    .from('trip_images').select('id, storage_path').eq('id', imageId).maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!img) throw new ServiceError('not_found', 'Image not found');

  const { error: delErr } = await supabase.from('trip_images').delete().eq('id', imageId);
  if (delErr) throw new ServiceError('internal', delErr.message);
  await supabase.storage.from('trip-images').remove([(img as { storage_path: string }).storage_path]);
}
```

- [ ] **Step 2: Implement the NFC service**

Create `lib/services/nfc.service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip, LinkNfcInput } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { getTrip } from './trips.service';

export async function linkNfc(
  supabase: SupabaseClient,
  tripId: string,
  input: LinkNfcInput,
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({ nfc_tag_id: input.nfcTagId, nfc_linked_at: new Date().toISOString() })
    .eq('id', tripId)
    .select('id')
    .maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');
  return getTrip(supabase, tripId);
}
```

- [ ] **Step 3: Typecheck**

Run: `cd magnetrip-web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add lib/services/images.service.ts lib/services/nfc.service.ts && git commit -m "feat(services): add images (upload/register/reorder/delete) and nfc services"
```

---

## Task 5: Public trip service

**Files:**
- Create: `lib/services/public.service.ts`

**Interfaces:**
- Produces: `getPublicTrip(supabase, publicId): Promise<PublicTrip>` — calls the `get_public_trip` RPC (Phase 1) and normalizes image URLs to absolute public URLs. Uses an anon/server client (no auth needed). Throws `not_found` when the RPC returns null.

- [ ] **Step 1: Implement the public service**

Create `lib/services/public.service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicTrip } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { getPublicEnv } from '@/lib/env';

// The get_public_trip RPC returns image urls as the object path "trip-images/<storage_path>".
// Convert to an absolute public URL for consumers.
function toAbsolute(objectPath: string): string {
  const { supabaseUrl } = getPublicEnv();
  return `${supabaseUrl}/storage/v1/object/public/${objectPath}`;
}

interface RpcTrip {
  name: string;
  year: number | null;
  description: string | null;
  images: { url: string; position: number }[];
}

export async function getPublicTrip(supabase: SupabaseClient, publicId: string): Promise<PublicTrip> {
  const { data, error } = await supabase.rpc('get_public_trip', { p_public_id: publicId });
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');
  const trip = data as RpcTrip;
  return {
    name: trip.name,
    year: trip.year,
    description: trip.description,
    images: (trip.images ?? []).map((img) => ({ url: toAbsolute(img.url), position: img.position })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd magnetrip-web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add lib/services/public.service.ts && git commit -m "feat(services): add public trip read service over get_public_trip RPC"
```

---

## Task 6: API error/bearer helpers + request parsing

**Files:**
- Create: `lib/api/errors.ts`, `lib/api/errors.test.ts`
- Create: `lib/api/route.ts`, `lib/api/route.test.ts`

**Interfaces:**
- Produces:
  - `extractBearerToken(header: string | null): string | null`.
  - `toHttpError(err: unknown): { status: number; message: string }` — ServiceError → its status+message; ZodError → 400 + first issue; else 500 + generic.
  - `route(handler: (request: Request, ctx: RouteCtx) => Promise<Response>): (request, ctx) => Promise<Response>` — wraps handler, catches errors → JSON `{ error }` with status. `RouteCtx = { params: Promise<Record<string,string>> }`.
  - `parseBody<T>(request: Request, schema: ZodType<T>): Promise<T>` — parses JSON body, throws `ServiceError('validation', ...)` on failure.

- [ ] **Step 1: Write the failing tests**

Create `lib/api/errors.test.ts`:
```ts
import { test, expect } from 'vitest';
import { z } from 'zod';
import { extractBearerToken, toHttpError } from './errors';
import { ServiceError } from '@/lib/services/errors';

test('extractBearerToken parses a Bearer header, else null', () => {
  expect(extractBearerToken('Bearer abc.def')).toBe('abc.def');
  expect(extractBearerToken('bearer abc')).toBe('abc'); // case-insensitive scheme
  expect(extractBearerToken('Basic xyz')).toBeNull();
  expect(extractBearerToken(null)).toBeNull();
  expect(extractBearerToken('')).toBeNull();
});

test('toHttpError maps ServiceError to its status + message', () => {
  expect(toHttpError(new ServiceError('not_found', 'nope'))).toEqual({ status: 404, message: 'nope' });
  expect(toHttpError(new ServiceError('validation', 'bad'))).toEqual({ status: 400, message: 'bad' });
});

test('toHttpError maps ZodError to 400 with a message', () => {
  const zerr = z.object({ a: z.string() }).safeParse({});
  const out = toHttpError((zerr as { error: unknown }).error);
  expect(out.status).toBe(400);
  expect(out.message.length).toBeGreaterThan(0);
});

test('toHttpError maps unknown errors to 500 generic', () => {
  expect(toHttpError(new Error('leak me'))).toEqual({ status: 500, message: 'Internal server error' });
  expect(toHttpError('weird')).toEqual({ status: 500, message: 'Internal server error' });
});
```

Create `lib/api/route.test.ts`:
```ts
import { test, expect } from 'vitest';
import { z } from 'zod';
import { parseBody } from './route';

const req = (body: unknown) =>
  new Request('http://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

test('parseBody returns validated data', async () => {
  const schema = z.object({ name: z.string() });
  await expect(parseBody(req({ name: 'ok' }), schema)).resolves.toEqual({ name: 'ok' });
});

test('parseBody throws a validation ServiceError on bad input', async () => {
  const schema = z.object({ name: z.string() });
  await expect(parseBody(req({ name: 1 }), schema)).rejects.toMatchObject({ kind: 'validation' });
});

test('parseBody throws validation on non-JSON body', async () => {
  const bad = new Request('http://x/api', { method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' } });
  await expect(parseBody(bad, z.object({ name: z.string() }))).rejects.toMatchObject({ kind: 'validation' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd magnetrip-web && pnpm exec vitest run lib/api/errors.test.ts lib/api/route.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the helpers**

Create `lib/api/errors.ts`:
```ts
import { ZodError } from 'zod';
import { ServiceError, httpStatusForKind } from '@/lib/services/errors';

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof ServiceError) {
    return { status: httpStatusForKind[err.kind], message: err.message };
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return { status: 400, message: first?.message ?? 'Invalid request' };
  }
  return { status: 500, message: 'Internal server error' };
}
```

Create `lib/api/route.ts`:
```ts
import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';
import { ServiceError } from '@/lib/services/errors';
import { toHttpError } from './errors';

export interface RouteCtx {
  params: Promise<Record<string, string>>;
}

type Handler = (request: Request, ctx: RouteCtx) => Promise<Response>;

export function route(handler: Handler): Handler {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (err) {
      const { status, message } = toHttpError(err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ServiceError('validation', 'Request body must be valid JSON');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ServiceError('validation', result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd magnetrip-web && pnpm exec vitest run lib/api/errors.test.ts lib/api/route.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/api/errors.ts lib/api/errors.test.ts lib/api/route.ts lib/api/route.test.ts && git commit -m "feat(api): add error mapping, bearer extraction, and request parsing helpers"
```

---

## Task 7: API auth context resolver

**Files:**
- Create: `lib/api/auth.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient` (cookie), `createUserSupabaseClient` (bearer), `extractBearerToken`, `ServiceError`.
- Produces: `resolveApiContext(request: Request): Promise<{ supabase: SupabaseClient; userId: string }>` — bearer token → user-scoped client; else cookie session client; validates via `getUser()`; throws `ServiceError('unauthorized')` if no user.

- [ ] **Step 1: Implement the resolver**

Create `lib/api/auth.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createUserSupabaseClient } from '@/lib/supabase/user-client';
import { ServiceError } from '@/lib/services/errors';
import { extractBearerToken } from './errors';

export async function resolveApiContext(
  request: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const token = extractBearerToken(request.headers.get('authorization'));
  const supabase = token ? createUserSupabaseClient(token) : await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ServiceError('unauthorized', 'Authentication required');
  return { supabase, userId: data.user.id };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd magnetrip-web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add lib/api/auth.ts && git commit -m "feat(api): resolve auth context from cookie session or bearer token"
```

---

## Task 8: Trips + images + nfc + uploads API routes

**Files:**
- Create: `app/api/trips/route.ts`
- Create: `app/api/trips/[id]/route.ts`
- Create: `app/api/trips/[id]/images/route.ts`
- Create: `app/api/trips/[id]/images/reorder/route.ts`
- Create: `app/api/trips/[id]/nfc/route.ts`
- Create: `app/api/images/[id]/route.ts`
- Create: `app/api/uploads/sign/route.ts`

**Interfaces:**
- Consumes: services (Tasks 3–4), `resolveApiContext`, `route`, `parseBody`, the Zod schemas.
- Produces: the authed HTTP endpoints. All wrapped with `route(...)`; all resolve the caller with `resolveApiContext`.

- [ ] **Step 1: Implement `app/api/trips/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, parseBody } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { createTripSchema } from '@/lib/validation/trip';
import { listTrips, createTrip } from '@/lib/services/trips.service';

export const GET = route(async (request) => {
  const { supabase } = await resolveApiContext(request);
  return NextResponse.json(await listTrips(supabase));
});

export const POST = route(async (request) => {
  const { supabase, userId } = await resolveApiContext(request);
  const input = await parseBody(request, createTripSchema);
  return NextResponse.json(await createTrip(supabase, userId, input), { status: 201 });
});
```

- [ ] **Step 2: Implement `app/api/trips/[id]/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { updateTripSchema } from '@/lib/validation/trip';
import { getTrip, updateTrip, deleteTrip } from '@/lib/services/trips.service';

export const GET = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  return NextResponse.json(await getTrip(supabase, id));
});

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, updateTripSchema);
  return NextResponse.json(await updateTrip(supabase, id, input));
});

export const DELETE = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  await deleteTrip(supabase, id);
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 3: Implement `app/api/trips/[id]/images/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { registerImageSchema } from '@/lib/validation/trip';
import { registerImage } from '@/lib/services/images.service';

export const POST = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, registerImageSchema);
  return NextResponse.json(await registerImage(supabase, id, input), { status: 201 });
});
```

- [ ] **Step 4: Implement `app/api/trips/[id]/images/reorder/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { reorderImagesSchema } from '@/lib/validation/trip';
import { reorderImages } from '@/lib/services/images.service';

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const { imageIds } = await parseBody(request, reorderImagesSchema);
  await reorderImages(supabase, id, imageIds);
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 5: Implement `app/api/trips/[id]/nfc/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { linkNfcSchema } from '@/lib/validation/trip';
import { linkNfc } from '@/lib/services/nfc.service';

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, linkNfcSchema);
  return NextResponse.json(await linkNfc(supabase, id, input));
});
```

- [ ] **Step 6: Implement `app/api/images/[id]/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { route, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { deleteImage } from '@/lib/services/images.service';

export const DELETE = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  await deleteImage(supabase, id);
  return new NextResponse(null, { status: 204 });
});
```

- [ ] **Step 7: Implement `app/api/uploads/sign/route.ts`**
```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route, parseBody } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { createSignedUpload } from '@/lib/services/images.service';

const signSchema = z.object({
  tripId: z.string().uuid(),
  ext: z.string().min(1).max(10),
});

export const POST = route(async (request) => {
  const { supabase, userId } = await resolveApiContext(request);
  const { tripId, ext } = await parseBody(request, signSchema);
  return NextResponse.json(await createSignedUpload(supabase, userId, tripId, ext));
});
```

- [ ] **Step 8: Build to verify all routes compile**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds; the new `/api/*` routes appear in the route list.

> Possible Next 16 gotcha: Next type-checks each route file's exported handlers against its generated route types. The `route()` HOF returns a `Handler` typed with `Request` + `RouteCtx.params: Promise<Record<string,string>>`, which should be assignable to Next's expected handler type — but if `pnpm build` reports a route-handler/params type error, resolve it by adjusting **only the typings** (e.g. widen `RouteCtx` to `{ params: Promise<Record<string, string | string[]>> }` or align the handler generic) until the route type check passes. Keep runtime behavior identical; do not weaken to `any` unless nothing else works, and note whatever you changed in the report.

- [ ] **Step 9: Commit**

```bash
cd magnetrip-web && git add app/api/trips app/api/images app/api/uploads && git commit -m "feat(api): add trips/images/nfc/uploads route handlers"
```

---

## Task 9: Public trip API route + typed api-client

**Files:**
- Create: `app/api/public/trips/[publicId]/route.ts`
- Create: `lib/api-client/index.ts`
- Create: `lib/api-client/index.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/public/trips/[publicId]` (no auth) → `PublicTrip`.
  - `lib/api-client`: `ApiError` (class with `status`), and `apiClient` object with `listTrips()`, `getTrip(id)`, `createTrip(input)`, `updateTrip(id, input)`, `deleteTrip(id)`, `signUpload(tripId, ext)`, `registerImage(tripId, input)`, `reorderImages(tripId, imageIds)`, `deleteImage(imageId)`, `linkNfc(tripId, input)`, `getPublicTrip(publicId)`. All same-origin `fetch` with `credentials: 'include'`; non-2xx → throws `ApiError` with the server `error` message.

- [ ] **Step 1: Implement the public route**

Create `app/api/public/trips/[publicId]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { route, type RouteCtx } from '@/lib/api/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPublicTrip } from '@/lib/services/public.service';

export const GET = route(async (_request, { params }: RouteCtx) => {
  const { publicId } = await params;
  const supabase = await createServerSupabaseClient();
  return NextResponse.json(await getPublicTrip(supabase, publicId));
});
```

- [ ] **Step 2: Write the failing api-client test**

Create `lib/api-client/index.test.ts`:
```ts
import { test, expect, vi, afterEach } from 'vitest';
import { apiClient, ApiError } from './index';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('listTrips GETs /api/trips with credentials and returns JSON', async () => {
  const fetchMock = stubFetch(200, [{ id: 't1', name: 'Trip' }]);
  const trips = await apiClient.listTrips();
  expect(trips).toEqual([{ id: 't1', name: 'Trip' }]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips');
  expect(init.credentials).toBe('include');
});

test('createTrip POSTs JSON body', async () => {
  const fetchMock = stubFetch(201, { id: 't2', name: 'New' });
  const trip = await apiClient.createTrip({ name: 'New' });
  expect(trip).toEqual({ id: 't2', name: 'New' });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ name: 'New' });
});

test('reorderImages PATCHes the reorder endpoint and resolves on 204', async () => {
  const fetchMock = stubFetch(204, undefined);
  await expect(apiClient.reorderImages('t1', ['a', 'b'])).resolves.toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips/t1/images/reorder');
  expect(init.method).toBe('PATCH');
});

test('non-2xx throws ApiError carrying status and server message', async () => {
  stubFetch(404, { error: 'Trip not found' });
  await expect(apiClient.getTrip('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404, message: 'Trip not found' });
  await expect(apiClient.getTrip('missing')).rejects.toBeInstanceOf(ApiError);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd magnetrip-web && pnpm exec vitest run lib/api-client/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the api-client**

Create `lib/api-client/index.ts`:
```ts
import type {
  Trip, TripListItem, TripImage, PublicTrip,
  CreateTripInput, UpdateTripInput, RegisterImageInput,
} from '@/lib/types/trip';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export const apiClient = {
  listTrips: () => request<TripListItem[]>('/api/trips'),
  getTrip: (id: string) => request<Trip>(`/api/trips/${id}`),
  createTrip: (input: CreateTripInput) => request<Trip>('/api/trips', { method: 'POST', body: input }),
  updateTrip: (id: string, input: UpdateTripInput) => request<Trip>(`/api/trips/${id}`, { method: 'PATCH', body: input }),
  deleteTrip: (id: string) => request<void>(`/api/trips/${id}`, { method: 'DELETE' }),
  signUpload: (tripId: string, ext: string) => request<SignedUpload>('/api/uploads/sign', { method: 'POST', body: { tripId, ext } }),
  registerImage: (tripId: string, input: RegisterImageInput) => request<TripImage>(`/api/trips/${tripId}/images`, { method: 'POST', body: input }),
  reorderImages: (tripId: string, imageIds: string[]) => request<void>(`/api/trips/${tripId}/images/reorder`, { method: 'PATCH', body: { imageIds } }),
  deleteImage: (imageId: string) => request<void>(`/api/images/${imageId}`, { method: 'DELETE' }),
  linkNfc: (tripId: string, nfcTagId: string) => request<Trip>(`/api/trips/${tripId}/nfc`, { method: 'PATCH', body: { nfcTagId } }),
  getPublicTrip: (publicId: string) => request<PublicTrip>(`/api/public/trips/${publicId}`),
};
```

- [ ] **Step 5: Run tests + build**

Run: `cd magnetrip-web && pnpm exec vitest run lib/api-client/index.test.ts && pnpm build`
Expected: tests PASS; build succeeds (public route listed).

- [ ] **Step 6: Commit**

```bash
cd magnetrip-web && git add app/api/public lib/api-client && git commit -m "feat(api): add public trip route and typed api-client"
```

---

## Task 10: Integration verification (controller-run against live Supabase)

**Files:**
- Create: `scripts/integration/phase2b.mjs`

**Interfaces:** none (verification harness). Exercises the services against the live project through a real user session to prove CRUD + RLS + public read work end-to-end.

> This task is run by the CONTROLLER (it needs the Supabase MCP to seed a login-able user and a running app). Subagents implementing earlier tasks do not run it.

- [ ] **Step 1: Seed a login-able test user (MCP)**

Via the Supabase MCP `execute_sql`, create a confirmed user with a known bcrypt password (idempotent):
```sql
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'itest@example.com', crypt('itest-password-123', gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}')
on conflict do nothing;
```
(If the row already exists from a prior run, that's fine.)

- [ ] **Step 2: Write the integration script**

Create `scripts/integration/phase2b.mjs`:
```js
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'itest@example.com', password: 'itest-password-123',
  });
  if (authErr) throw new Error('sign-in failed: ' + authErr.message);
  const token = auth.session.access_token;
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const api = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: H, body: body && JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  // create → list → get → update → delete
  const created = await api('POST', '/api/trips', { name: 'Integration Trip', year: 2024 });
  if (created.status !== 201) throw new Error('create failed: ' + JSON.stringify(created));
  const id = created.body.id;

  const list = await api('GET', '/api/trips');
  if (!list.body.some((t) => t.id === id)) throw new Error('created trip not in list');

  const patched = await api('PATCH', `/api/trips/${id}`, { description: 'updated' });
  if (patched.body.description !== 'updated') throw new Error('update failed');

  const publicId = created.body.publicId;
  const pub = await api('GET', `/api/public/trips/${publicId}`);
  if (pub.status !== 200 || pub.body.name !== 'Integration Trip') throw new Error('public read failed');
  if ('userId' in pub.body) throw new Error('public read leaked owner data');

  const del = await api('DELETE', `/api/trips/${id}`);
  if (del.status !== 204) throw new Error('delete failed');

  const gone = await api('GET', `/api/trips/${id}`);
  if (gone.status !== 404) throw new Error('expected 404 after delete, got ' + gone.status);

  // unauthenticated request is rejected
  const anon = await fetch(`${BASE}/api/trips`);
  if (anon.status !== 401) throw new Error('expected 401 for unauthenticated list, got ' + anon.status);

  console.log('PHASE 2B INTEGRATION: PASS');
}

main().catch((e) => { console.error('PHASE 2B INTEGRATION: FAIL —', e.message); process.exit(1); });
```

- [ ] **Step 3: Run the integration pass (controller)**

Start the app and run the script:
```bash
cd magnetrip-web && pnpm dev   # in one shell (or a background process)
# in another, once it's serving:
cd magnetrip-web && node --env-file=.env scripts/integration/phase2b.mjs
```
Expected: `PHASE 2B INTEGRATION: PASS`. If email confirmation blocked the seeded user, confirm the Step 1 row has `email_confirmed_at` set (it does). Requires the Supabase Auth password grant to be enabled (default).

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add scripts/integration/phase2b.mjs && git commit -m "test(api): add phase 2b integration verification harness"
```

---

## Definition of Done (Phase 2b)

- `pnpm test` passes (errors, mappers, api errors, route parsing, api-client — all TDD units).
- `pnpm build` + `tsc --noEmit` clean; all `/api/*` routes present.
- `trip_images` has an owner UPDATE policy (migration 0005 applied).
- Integration harness prints `PHASE 2B INTEGRATION: PASS` against live Supabase: create/list/get/update/delete works, public read returns only public fields, unauthenticated calls get 401, delete then get returns 404.
- No page/component imports `supabase-js` for data (all data via `api-client` → `app/api/*`).

## Follow-up (Phase 2c)

- Dashboard (cards: cover, name, year, description preview, Edit/Delete/Public-page/Copy-link) + trip editor (fields + image manager: multi-upload via `signUpload`→direct storage upload→`registerImage`, drag-reorder via `reorderImages`, delete, set cover via `updateTrip`), all consuming `apiClient`.
- FIRST: extend `PROTECTED_PREFIXES` (or guard the `(app)` group) for any authed route outside `/dashboard`.
- Add chart/sidebar design tokens before using shadcn sidebar/chart components.
- Consider a `updateSession` try/catch (middleware resilience) and surfacing `?error=auth_callback` on login (deferred 2a hardening).
