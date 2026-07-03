# Magnetrip Phase 3 — Public Trip Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public, no-auth trip page at `/t/[publicId]` — a polished, responsive, server-rendered gallery (name, year, description, images) that anyone can open. This is the exact URL Flutter writes to NFC tags, so it must be crawlable, fast, and correct.

**Architecture:** A React Server Component fetches the trip through the existing public API route (`GET /api/public/trips/[publicId]`, backed by the anon-safe `get_public_trip` RPC — no owner data) using a request-relative absolute URL derived from `headers()`, honoring the project rule that Next reaches data through the API layer. Missing trips → Next `notFound()` (404). Includes `generateMetadata` for share/SEO, a `loading` skeleton, and a `not-found` page. Images use `next/image` (lazy, sized) against the already-allowed Supabase host.

**Tech Stack:** Next.js 16 App Router (Server Components, `generateMetadata`, `notFound`, `loading`/`not-found` conventions), `next/image`, `next/headers`, shadcn `Skeleton`, `lucide-react`.

## Global Constraints

- Write only inside `magnetrip-web/`. TypeScript strict; pnpm; design tokens/theme classes only (no hardcoded hex); no shadcn sidebar/chart.
- No `supabase-js` in the page/components — data goes through the API route `GET /api/public/trips/[publicId]` (already built). The page is a Server Component and fetches it via an absolute URL built from the incoming request's `headers()` (works in local dev AND production; do NOT hardcode `NEXT_PUBLIC_SITE_URL` as the fetch base, or local dev would read production data).
- The public route already returns: **404** for a missing/unknown `publicId` (the service throws `not_found`, mapped by the `route()` wrapper), and **200** with `PublicTrip` = `{ name, year: number|null, description: string|null, images: { url, position }[] }` (image `url`s are absolute Supabase public URLs). No owner fields are ever present.
- The page must render with NO app chrome (it's outside `(app)`/`(auth)`; only the root layout applies) and require NO authentication (the proxy middleware doesn't protect `/t/*` — confirmed: `PROTECTED_PREFIXES` is `['/dashboard','/trips']`).
- Every state present: loading (skeleton), not-found (friendly 404), empty images (placeholder).
- Conventional Commits on branch `feat/magnetrip-mvp`.
- Reuse: `PublicTrip` type (`@/lib/types/trip`); `next.config.ts` `images.remotePatterns` already allows `*.supabase.co/storage/v1/object/public/**`; shadcn `Skeleton` (`@/components/ui/skeleton`).
- A dev seed trip exists for verification: `publicId = 'seedpublic1'`, name `'Seed Trip'`, year 2024 (created in earlier phases; has no images).

## Testing approach

- No pure logic worth unit-testing (the page is SSR glue). Verified by `pnpm build` + `tsc` and a **controller-run SSR check**: `curl` the rendered HTML for the seed trip (asserts the name is in the HTML) and assert a 404 for an unknown id. Production/NFC verification happens post-merge/deploy (Task 3 notes it).

---

## File Structure

- `lib/trips/public-fetch.ts` — `fetchPublicTrip(publicId): Promise<PublicTrip | null>` (headers-based absolute fetch of the public API; 404 → null).
- `app/t/[publicId]/page.tsx` — Server Component: `generateMetadata` + the page (header + gallery); `notFound()` on null.
- `app/t/[publicId]/loading.tsx` — skeleton.
- `app/t/[publicId]/not-found.tsx` — friendly "trip not found".
- `components/public/trip-gallery.tsx` — responsive, lazy `next/image` grid + empty placeholder.

---

## Task 1: Public fetch helper + page + metadata + loading/not-found

**Files:**
- Create: `lib/trips/public-fetch.ts`
- Create: `app/t/[publicId]/page.tsx`
- Create: `app/t/[publicId]/loading.tsx`
- Create: `app/t/[publicId]/not-found.tsx`

**Interfaces:**
- Consumes: `PublicTrip` (`@/lib/types/trip`), the public API route, `next/headers`, `next/navigation` `notFound`, shadcn `Skeleton`, `TripGallery` (Task 2 — imported here; created next).
- Produces: `fetchPublicTrip(publicId: string): Promise<PublicTrip | null>`; the rendered `/t/[publicId]` route with metadata + loading + not-found.

- [ ] **Step 1: Implement the fetch helper**

Create `lib/trips/public-fetch.ts`:
```ts
import { headers } from 'next/headers';
import type { PublicTrip } from '@/lib/types/trip';

/** Absolute base URL for the CURRENT deployment, from the incoming request. */
async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** Fetch a public trip via the API layer. Returns null when the trip does not exist (404). */
export async function fetchPublicTrip(publicId: string): Promise<PublicTrip | null> {
  const base = await requestBaseUrl();
  const res = await fetch(`${base}/api/public/trips/${encodeURIComponent(publicId)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load trip (${res.status})`);
  return (await res.json()) as PublicTrip;
}
```

- [ ] **Step 2: Implement the page + metadata**

Create `app/t/[publicId]/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicTrip } from '@/lib/trips/public-fetch';
import { TripGallery } from '@/components/public/trip-gallery';

type Params = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) return { title: 'Trip not found · Magnetrip' };
  const description = trip.description ?? 'A travel trip on Magnetrip';
  return {
    title: `${trip.name} · Magnetrip`,
    description,
    openGraph: {
      title: trip.name,
      description,
      images: trip.images[0] ? [{ url: trip.images[0].url }] : [],
    },
  };
}

export default async function PublicTripPage({ params }: Params) {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{trip.name}</h1>
        {trip.year ? <p className="text-sm font-medium text-muted-foreground">{trip.year}</p> : null}
        {trip.description ? (
          <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-foreground/90">
            {trip.description}
          </p>
        ) : null}
      </header>
      <div className="mt-8">
        <TripGallery images={trip.images} alt={trip.name} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Implement the loading skeleton**

Create `app/t/[publicId]/loading.tsx`:
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingPublicTrip() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Implement the not-found page**

Create `app/t/[publicId]/not-found.tsx`:
```tsx
import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function TripNotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">Trip not found</h1>
      <p className="text-sm text-muted-foreground">This trip doesn&apos;t exist or is no longer available.</p>
      <Link href="/" className="text-sm text-primary hover:underline">Go to Magnetrip</Link>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds. It will fail to resolve `@/components/public/trip-gallery` until Task 2 — so if you are executing strictly task-by-task, create a temporary minimal `TripGallery` stub, OR implement Task 2 before running the build. (The reviewer/controller runs the build after Task 2.)

- [ ] **Step 6: Commit**

```bash
cd magnetrip-web && git add lib/trips/public-fetch.ts "app/t/[publicId]/page.tsx" "app/t/[publicId]/loading.tsx" "app/t/[publicId]/not-found.tsx" && git commit -m "feat(public): add public trip page with metadata, loading, and not-found"
```

---

## Task 2: Responsive image gallery

**Files:**
- Create: `components/public/trip-gallery.tsx`

**Interfaces:**
- Consumes: `next/image` (Supabase host already allowed in `next.config.ts`).
- Produces: `<TripGallery images={{ url, position }[]} alt={string} />` — a responsive lazy-loaded grid; renders a placeholder when there are no images. Sorts by `position`.

- [ ] **Step 1: Implement the gallery**

Create `components/public/trip-gallery.tsx`:
```tsx
import Image from 'next/image';

export function TripGallery({
  images,
  alt,
}: {
  images: { url: string; position: number }[];
  alt: string;
}) {
  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No photos yet.
      </div>
    );
  }
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sorted.map((img, i) => (
        <div key={`${img.url}-${i}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          <Image
            src={img.url}
            alt={`${alt} — photo ${i + 1}`}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            loading="lazy"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + typecheck**

Run: `cd magnetrip-web && pnpm build && pnpm exec tsc --noEmit`
Expected: build succeeds; `/t/[publicId]` appears in the route list as a dynamic route.

- [ ] **Step 3: Commit**

```bash
cd magnetrip-web && git add components/public/trip-gallery.tsx && git commit -m "feat(public): add responsive lazy-loaded trip image gallery"
```

---

## Task 3: SSR verification (controller-run)

**Files:** none (verification).

> Run by the controller. The public page is server-rendered HTML, so it's verifiable with `curl` (unlike the client UI of Phase 2c).

- [ ] **Step 1: Ensure the seed trip exists**

Via Supabase MCP `execute_sql`, confirm the seed trip is present (recreate if a prior cleanup removed it):
```sql
select public.get_public_trip('seedpublic1') is not null as seed_present;
```
Expected: `seed_present = true`. If false, the seed can be recreated by inserting a trip with `public_id='seedpublic1'` for any existing user id.

- [ ] **Step 2: Verify SSR output against the running app**

Start the app and curl the public page + a missing id:
```bash
cd magnetrip-web && pnpm dev > /tmp/dev.log 2>&1 &   # controller backgrounds this
# once serving:
curl -s http://localhost:3000/t/seedpublic1 | grep -q "Seed Trip" && echo "PUBLIC PAGE: renders trip name"
curl -s -o /dev/null -w "missing -> %{http_code}\n" http://localhost:3000/t/does-not-exist-xyz
```
Expected: `PUBLIC PAGE: renders trip name` (the trip name is in the server-rendered HTML), and `missing -> 404` for the unknown id. Stop the dev server after.

- [ ] **Step 3: Note production + NFC verification (post-merge/deploy)**

Record in the task report that end-to-end production verification happens after this merges to the production branch and Vercel deploys: open `https://magnetrip-web.vercel.app/t/{publicId}` for a real trip (created via the dashboard) and confirm it renders name/year/description + gallery with no login. This is the URL Flutter will write to NFC. (Optionally confirm the deployment via the Vercel MCP.)

- [ ] **Step 4: Commit (if the report is tracked)**

No code to commit; record results in the SDD report/ledger.

---

## Definition of Done (Phase 3)

- `pnpm build` + `tsc --noEmit` clean; `/t/[publicId]` present as a dynamic route.
- `pnpm test` still green (no unit tests added; existing suite unaffected).
- SSR check (Task 3) passes: `/t/seedpublic1` HTML contains the trip name; unknown id returns 404.
- Public page requires no auth, renders name/year/description + a responsive lazy gallery, has loading + not-found + empty states, uses tokens only, and exposes no owner data (it goes through the anon-safe API).

## Follow-up (Flutter phases)

- **Flutter foundation:** theme from `magnetrip/lib/theme/app_theme.dart` (generated), config (`API_BASE_URL` via `--dart-define` = `https://magnetrip-web.vercel.app`), `dio` client + auth interceptor (Supabase JWT), Riverpod, login + forgot-password, trip list (create/rename/delete via the REST API with `Bearer` tokens).
- **Flutter NFC:** create-trip → write the public URL (`https://magnetrip-web.vercel.app/t/{publicId}`) to an NDEF tag; relink; full NFC error handling. Physical device required (iOS: Core NFC entitlement + paid Apple Developer account).
- Deferred web hardening still open (see 2a/2b/2c ledgers): `updateSession` try/catch; surface `?error=auth_callback` on login; relocate `uploads/sign` schema; the 2c UI Minors (year client range, image `sizes` breakpoints, per-tile busy state).
