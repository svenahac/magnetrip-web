# Magnetrip Phase 2c — Dashboard & Trip Editor UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated owner UI — a dashboard listing the user's trips (with create/edit/delete/copy-link/show-public actions) and a trip editor (edit name/year/description + an image manager: multi-upload, set cover, delete, drag-reorder) — all consuming the Phase 2b `apiClient`.

**Architecture:** Client components (`'use client'`) fetch and mutate through the typed `apiClient` (relative `fetch` with `credentials: 'include'`) — no page imports `supabase-js` for DB data. The one exception is uploading image **bytes**: the browser uploads directly to Supabase Storage via a signed upload URL (obtained from `apiClient.signUpload`), then registers the DB row via `apiClient.registerImage`. Every screen has loading (skeletons), error (retry), and empty states. Route protection is extended to cover the new `/trips/*` editor route.

**Tech Stack:** Next.js 16 App Router (client components), React 19, TypeScript strict, shadcn/ui (card, dialog, alert-dialog, dropdown-menu, empty, badge, aspect-ratio, skeleton, textarea, input, label, button, sonner, spinner), `lucide-react`, `next/image`, Vitest.

## Global Constraints

- Write only inside `magnetrip-web/`.
- **No page/component imports `supabase-js` for DB data** — all trip/image data goes through `apiClient` (`@/lib/api-client`). The ONLY allowed direct Supabase call is `createBrowserSupabaseClient().storage.from('trip-images').uploadToSignedUrl(...)` for uploading file bytes (Task 7) — that's storage, not DB; the row is still registered via `apiClient.registerImage`.
- TypeScript strict; pnpm; design tokens/theme classes only (no hardcoded hex). Light theme.
- Do NOT use the shadcn `sidebar` or `chart` components (their `@theme` variables are undefined in this project — a known deferred item). Build layout with flin/grid + card.
- Every screen: loading, error (with retry), and — where applicable — empty states, with friendly copy. Never leak raw errors; `apiClient` already throws `ApiError` with a user-safe `message` — show `error.message`.
- Conventional Commits on branch `feat/magnetrip-mvp`.
- **Route protection (do FIRST — Task 1):** the editor lives at `/trips/[id]/edit`, outside `/dashboard`. It MUST be added to `PROTECTED_PREFIXES` or the middleware won't guard it.
- Reuse from earlier phases:
  - `apiClient` (`@/lib/api-client`): `listTrips()`, `getTrip(id)`, `createTrip(input)`, `updateTrip(id, input)`, `deleteTrip(id)`, `signUpload(tripId, ext)`, `registerImage(tripId, input)`, `reorderImages(tripId, imageIds)`, `deleteImage(imageId)` — and `ApiError`.
  - DTO types (`@/lib/types/trip`): `Trip`, `TripListItem`, `TripImage`.
  - `getPublicEnv()` (`@/lib/env`) for `siteUrl`; `createBrowserSupabaseClient()` (`@/lib/supabase/client`) for storage upload only.
  - `PROTECTED_PREFIXES`/`isProtectedPath` (`@/lib/auth/routes`); `AuthShell` pattern; `Toaster` already mounted in root layout; `(app)/layout.tsx` header + sign-out already exists.
- Public trip page (`/t/[publicId]`) is Phase 3, NOT this plan.

## Testing approach

- **Unit-TDD:** the route-guard change (Task 1) and the pure presentation helpers (Task 2). No component/e2e harness exists (consistent with Phase 2a), so pages/components are verified by `pnpm build` + `tsc` + a manual checklist against the running app (end of plan). Keep genuinely-testable logic in the pure helpers.

---

## File Structure

- `lib/auth/routes.ts` — MODIFY: add `/trips` to `PROTECTED_PREFIXES`.
- `lib/auth/routes.test.ts` — MODIFY: assert `/trips/*` is protected.
- `lib/trips/format.ts` — `publicTripUrl(publicId)`, `descriptionPreview(text, max?)`, `fileExtension(filename)`.
- `lib/trips/format.test.ts`.
- `next.config.ts` — MODIFY: allow Supabase Storage host for `next/image`.
- `components/trips/trip-card.tsx` — presentational card + actions menu.
- `components/trips/new-trip-dialog.tsx` — create-trip dialog.
- `components/trips/delete-trip-dialog.tsx` — delete confirm.
- `app/(app)/dashboard/page.tsx` — REPLACE stub: fetch + grid + states + create.
- `app/(app)/trips/[id]/edit/page.tsx` — editor (fields + save).
- `components/trips/trip-details-form.tsx` — name/year/description form.
- `components/trips/image-manager.tsx` — upload + gallery + delete + set-cover.
- `components/trips/image-reorder.tsx` — drag-reorder wiring (used by image-manager).
- `lib/trips/upload.ts` — `uploadTripImage(tripId, file, position)` orchestration (signUpload → storage PUT → registerImage).

---

## Task 1: Guard the /trips route prefix

**Files:**
- Modify: `lib/auth/routes.ts`
- Modify: `lib/auth/routes.test.ts`

**Interfaces:** Produces: `/trips` and `/trips/...` now classified protected by `isProtectedPath` (consumed by `proxy.ts`).

- [ ] **Step 1: Add the failing assertions**

In `lib/auth/routes.test.ts`, inside the existing `isProtectedPath` test, add:
```ts
  expect(isProtectedPath('/trips')).toBe(true);
  expect(isProtectedPath('/trips/abc/edit')).toBe(true);
  expect(isProtectedPath('/tripsomething')).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd magnetrip-web && pnpm exec vitest run lib/auth/routes.test.ts`
Expected: FAIL — `/trips` currently returns false.

- [ ] **Step 3: Extend PROTECTED_PREFIXES**

In `lib/auth/routes.ts`, change:
```ts
export const PROTECTED_PREFIXES = ['/dashboard'] as const;
```
to:
```ts
export const PROTECTED_PREFIXES = ['/dashboard', '/trips'] as const;
```
(The existing `isProtectedPath` already matches `pathname === p || pathname.startsWith(p + '/')`, so `/tripsomething` correctly stays unprotected.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd magnetrip-web && pnpm exec vitest run lib/auth/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/auth/routes.ts lib/auth/routes.test.ts && git commit -m "feat(auth): protect /trips editor route prefix"
```

---

## Task 2: Presentation helpers

**Files:**
- Create: `lib/trips/format.ts`, `lib/trips/format.test.ts`

**Interfaces:**
- Produces: `publicTripUrl(publicId: string): string` (`${siteUrl}/t/${publicId}`), `descriptionPreview(text: string | null, max?: number): string` (trimmed, truncated with `…`), `fileExtension(filename: string): string` (lowercased extension without dot, `''` if none).

- [ ] **Step 1: Write the failing test**

Create `lib/trips/format.test.ts`:
```ts
import { test, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://magnetrip-web.vercel.app';
});

const { publicTripUrl, descriptionPreview, fileExtension } = await import('./format');

test('publicTripUrl builds the public page URL from the site origin', () => {
  expect(publicTripUrl('abc123')).toBe('https://magnetrip-web.vercel.app/t/abc123');
});

test('descriptionPreview trims, returns empty for null, and truncates with an ellipsis', () => {
  expect(descriptionPreview(null)).toBe('');
  expect(descriptionPreview('  short  ')).toBe('short');
  expect(descriptionPreview('a'.repeat(200), 10)).toBe('aaaaaaaaaa…');
  expect(descriptionPreview('exactly-ten', 11)).toBe('exactly-ten');
});

test('fileExtension returns the lowercased extension, or empty when none', () => {
  expect(fileExtension('Photo.JPG')).toBe('jpg');
  expect(fileExtension('a.b.png')).toBe('png');
  expect(fileExtension('noext')).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd magnetrip-web && pnpm exec vitest run lib/trips/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `lib/trips/format.ts`:
```ts
import { getPublicEnv } from '@/lib/env';

export function publicTripUrl(publicId: string): string {
  return `${getPublicEnv().siteUrl}/t/${publicId}`;
}

export function descriptionPreview(text: string | null, max = 120): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + '…';
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd magnetrip-web && pnpm exec vitest run lib/trips/format.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/trips/format.ts lib/trips/format.test.ts && git commit -m "feat(trips): add public-url, description-preview, and file-extension helpers"
```

---

## Task 3: Allow Supabase Storage images + TripCard component

**Files:**
- Modify: `next.config.ts`
- Create: `components/trips/trip-card.tsx`

**Interfaces:**
- Consumes: `TripListItem` (`@/lib/types/trip`), `descriptionPreview`/`publicTripUrl` (Task 2), shadcn `Card`, `Badge`, `DropdownMenu`, `Button`, `AspectRatio`, `next/image`, `lucide-react`.
- Produces: `<TripCard trip={...} onDelete={(id)=>void} />` — cover image (or gradient placeholder), name, year badge, description preview, and an actions menu (Edit → `/trips/{id}/edit`, Show public page, Copy public link, Delete). Copy uses `navigator.clipboard` + `toast`.

- [ ] **Step 1: Allow the Supabase Storage host for `next/image`**

Edit `next.config.ts` to add `images.remotePatterns` (merge into the existing config object):
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
```
(If `next.config.ts` already has other keys, keep them and only add the `images` block.)

- [ ] **Step 2: Implement TripCard**

Create `components/trips/trip-card.tsx`:
```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Pencil, ExternalLink, Link as LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TripListItem } from '@/lib/types/trip';
import { descriptionPreview, publicTripUrl } from '@/lib/trips/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TripCard({ trip, onDelete }: { trip: TripListItem; onDelete: (id: string) => void }) {
  const url = publicTripUrl(trip.publicId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  }

  return (
    <Card className="overflow-hidden">
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {trip.coverUrl ? (
          <Image src={trip.coverUrl} alt={trip.name} fill sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-primary/80 via-primary/40 to-brand-accent/60" />
        )}
      </AspectRatio>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{trip.name}</h3>
            {trip.year ? <Badge variant="secondary" className="mt-1">{trip.year}</Badge> : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Trip actions">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/trips/${trip.id}/edit`}><Pencil className="size-4" /> Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Show public page</a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void copyLink(); }}>
                <LinkIcon className="size-4" /> Copy public link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(trip.id)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {descriptionPreview(trip.description) ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{descriptionPreview(trip.description)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds. (If a shadcn export name differs — e.g. `DropdownMenuItem` `variant` prop — check `components/ui/dropdown-menu.tsx` and adjust; the destructive style can fall back to `className="text-destructive"`.)

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add next.config.ts components/trips/trip-card.tsx && git commit -m "feat(dashboard): add TripCard with cover, actions menu, and next/image config"
```

---

## Task 4: Dashboard page (list, states, create)

**Files:**
- Create: `components/trips/new-trip-dialog.tsx`
- Create: `components/trips/delete-trip-dialog.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (replace the Phase 2a stub body)

**Interfaces:**
- Consumes: `apiClient`, `ApiError`, `TripListItem`, `TripCard` (Task 3), shadcn `Dialog`/`AlertDialog`/`Input`/`Label`/`Button`/`Skeleton`/`Empty`, `useRouter`, `toast`.
- Produces: the real dashboard — fetches trips on mount, shows skeleton/empty/error/list; a **New trip** dialog (name → `createTrip` → navigate to `/trips/{id}/edit`); delete via a confirm dialog (`deleteTrip` → remove from list + toast).

- [ ] **Step 1: Implement the New Trip dialog**

Create `components/trips/new-trip-dialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function NewTripDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) { setError('Please enter a trip name'); return; }
    setLoading(true);
    try {
      const trip = await apiClient.createTrip({ name: name.trim() });
      router.push(`/trips/${trip.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the trip');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="size-4" /> New trip</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a trip</DialogTitle></DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip name</Label>
            <Input id="trip-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amalfi Coast" disabled={loading} autoFocus />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Implement the Delete confirm dialog**

Create `components/trips/delete-trip-dialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DeleteTripDialog({
  tripId, open, onOpenChange, onDeleted,
}: {
  tripId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!tripId) return;
    setLoading(true);
    try {
      await apiClient.deleteTrip(tripId);
      onDeleted(tripId);
      toast.success('Trip deleted');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the trip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the trip and its images. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirm(); }} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Replace the dashboard page**

Replace the contents of `app/(app)/dashboard/page.tsx` with:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { TripListItem } from '@/lib/types/trip';
import { TripCard } from '@/components/trips/trip-card';
import { NewTripDialog } from '@/components/trips/new-trip-dialog';
import { DeleteTripDialog } from '@/components/trips/delete-trip-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export default function DashboardPage() {
  const [trips, setTrips] = useState<TripListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setTrips(null);
    try {
      setTrips(await apiClient.listTrips());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your trips');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your trips</h1>
        <NewTripDialog />
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Try again</Button>
        </div>
      ) : trips === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
            <EmptyTitle>No trips yet</EmptyTitle>
            <EmptyDescription>Create your first Magnet to start collecting memories.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><NewTripDialog /></EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onDelete={setDeleteId} />
          ))}
        </div>
      )}

      <DeleteTripDialog
        tripId={deleteId}
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onDeleted={(id) => setTrips((cur) => (cur ?? []).filter((t) => t.id !== id))}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds. (If the `Empty` subcomponent export names differ, check `components/ui/empty.tsx` and adjust to the actual exports.)

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add "app/(app)/dashboard/page.tsx" components/trips/new-trip-dialog.tsx components/trips/delete-trip-dialog.tsx && git commit -m "feat(dashboard): trip grid with loading/empty/error states, create, and delete"
```

---

## Task 5: Trip editor — details form

**Files:**
- Create: `components/trips/trip-details-form.tsx`
- Create: `app/(app)/trips/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `apiClient`, `ApiError`, `Trip`, shadcn `Input`/`Label`/`Textarea`/`Button`/`Skeleton`, `useParams`, `useRouter`, `toast`.
- Produces: the editor page — loads the trip (`getTrip`) with loading/error states; renders `<TripDetailsForm trip={...} onSaved={...} />` (name/year/description → `updateTrip`) and (Task 6) the image manager. `TripDetailsForm` is a controlled form that saves on submit.

- [ ] **Step 1: Implement the details form**

Create `components/trips/trip-details-form.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Trip } from '@/lib/types/trip';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function TripDetailsForm({ trip, onSaved }: { trip: Trip; onSaved: (t: Trip) => void }) {
  const [name, setName] = useState(trip.name);
  const [year, setYear] = useState(trip.year?.toString() ?? '');
  const [description, setDescription] = useState(trip.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) { setError('Trip name is required'); return; }
    const parsedYear = year.trim() === '' ? null : Number(year);
    if (parsedYear !== null && !Number.isInteger(parsedYear)) { setError('Year must be a whole number'); return; }
    setLoading(true);
    try {
      const updated = await apiClient.updateTrip(trip.id, {
        name: name.trim(),
        year: parsedYear,
        description: description.trim() === '' ? null : description.trim(),
      });
      onSaved(updated);
      toast.success('Saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Trip name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="year">Year</Label>
        <Input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2024" disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={5} value={description}
          onChange={(e) => setDescription(e.target.value)} disabled={loading} />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Implement the editor page (details only for now; image manager added in Task 6)**

Create `app/(app)/trips/[id]/edit/page.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Trip } from '@/lib/types/trip';
import { TripDetailsForm } from '@/components/trips/trip-details-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function TripEditorPage() {
  const id = useParams<{ id: string }>().id;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setTrip(null);
    try {
      setTrip(await apiClient.getTrip(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this trip');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to trips
      </Link>

      {error ? (
        <div role="alert" className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Try again</Button>
        </div>
      ) : trip === null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <TripDetailsForm trip={trip} onSaved={setTrip} />
          {/* Image manager is mounted here in Task 6 */}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds; `/trips/[id]/edit` appears in the route list.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add "app/(app)/trips/[id]/edit/page.tsx" components/trips/trip-details-form.tsx && git commit -m "feat(editor): trip editor page with details form"
```

---

## Task 6: Image manager — upload, gallery, delete, set cover

**Files:**
- Create: `lib/trips/upload.ts`
- Create: `components/trips/image-manager.tsx`
- Modify: `app/(app)/trips/[id]/edit/page.tsx` (mount the image manager)

**Interfaces:**
- Consumes: `apiClient` (`signUpload`, `registerImage`, `deleteImage`, `updateTrip`), `createBrowserSupabaseClient` (storage upload only), `Trip`/`TripImage`, `fileExtension` (Task 2), shadcn `Button`/`Badge`/`AspectRatio`/`Spinner`, `next/image`, `toast`.
- Produces:
  - `uploadTripImage(tripId: string, file: File, position: number): Promise<TripImage>` in `lib/trips/upload.ts` — signUpload → storage `uploadToSignedUrl` → registerImage (reads image natural width/height).
  - `<ImageManager trip={trip} onChange={(images)=>void} />` — file picker (multi), gallery grid with per-image "Set cover" + "Delete", cover badge, upload progress, error toasts.

- [ ] **Step 1: Implement the upload orchestration**

Create `lib/trips/upload.ts`:
```ts
import { apiClient } from '@/lib/api-client';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fileExtension } from '@/lib/trips/format';
import type { TripImage } from '@/lib/types/trip';

async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return {};
  }
}

/** Upload one image: get a signed URL, PUT the bytes to Storage, then register the DB row. */
export async function uploadTripImage(tripId: string, file: File, position: number): Promise<TripImage> {
  const ext = fileExtension(file.name) || 'jpg';
  const { path, token } = await apiClient.signUpload(tripId, ext);

  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.storage.from('trip-images').uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);

  const { width, height } = await readDimensions(file);
  return apiClient.registerImage(tripId, { storagePath: path, position, width, height });
}
```

- [ ] **Step 2: Implement the image manager**

Create `components/trips/image-manager.tsx`:
```tsx
'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { uploadTripImage } from '@/lib/trips/upload';
import type { Trip, TripImage } from '@/lib/types/trip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Spinner } from '@/components/ui/spinner';

export function ImageManager({ trip, onChange }: { trip: Trip; onChange: (t: Trip) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<TripImage[]>(trip.images);
  const [coverId, setCoverId] = useState<string | null>(trip.coverImageId);
  const [uploading, setUploading] = useState(false);

  function apply(next: TripImage[]) {
    setImages(next);
    onChange({ ...trip, images: next, coverImageId: coverId });
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    const next = [...images];
    for (const file of files) {
      try {
        const img = await uploadTripImage(trip.id, file, next.length);
        next.push(img);
        apply([...next]);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  async function remove(imageId: string) {
    try {
      await apiClient.deleteImage(imageId);
      apply(images.filter((i) => i.id !== imageId));
      if (coverId === imageId) setCoverId(null);
      toast.success('Image removed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the image');
    }
  }

  async function setCover(imageId: string) {
    try {
      const updated = await apiClient.updateTrip(trip.id, { coverImageId: imageId });
      setCoverId(updated.coverImageId);
      onChange(updated);
      toast.success('Cover updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not set the cover');
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Images</h2>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner /> : <ImagePlus className="size-4" />} Add images
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      </div>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No images yet. Add photos to build your trip gallery.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-border">
              <AspectRatio ratio={1}>
                <Image src={img.url} alt="" fill sizes="33vw" className="object-cover" />
              </AspectRatio>
              {coverId === img.id ? (
                <Badge className="absolute left-2 top-2">Cover</Badge>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" aria-label="Set as cover"
                  onClick={() => void setCover(img.id)}><Star className="size-4" /></Button>
                <Button type="button" size="icon" variant="destructive" aria-label="Delete image"
                  onClick={() => void remove(img.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Mount the image manager in the editor**

In `app/(app)/trips/[id]/edit/page.tsx`, add the import:
```tsx
import { ImageManager } from '@/components/trips/image-manager';
```
and replace the comment line `{/* Image manager is mounted here in Task 6 */}` with:
```tsx
          <ImageManager trip={trip} onChange={setTrip} />
```

- [ ] **Step 4: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds. (If `Spinner` export differs, check `components/ui/spinner.tsx`.)

- [ ] **Step 5: Commit**

```bash
cd magnetrip-web && git add lib/trips/upload.ts components/trips/image-manager.tsx "app/(app)/trips/[id]/edit/page.tsx" && git commit -m "feat(editor): image manager with upload, delete, and set-cover"
```

---

## Task 7: Image manager — drag reordering

**Files:**
- Modify: `components/trips/image-manager.tsx`

**Interfaces:**
- Consumes: `apiClient.reorderImages`.
- Produces: drag-and-drop reordering of the gallery (native HTML5 DnD, no new dependency); on drop, reorder locally and persist via `reorderImages(trip.id, ids)`, reverting + toasting on failure.

- [ ] **Step 1: Add drag state and handlers to ImageManager**

In `components/trips/image-manager.tsx`, add a drag-index state near the other `useState` hooks:
```tsx
  const [dragIndex, setDragIndex] = useState<number | null>(null);
```
Add this reorder handler inside the component (after `setCover`):
```tsx
  async function persistOrder(next: TripImage[]) {
    const previous = images;
    apply(next);
    try {
      await apiClient.reorderImages(trip.id, next.map((i) => i.id));
    } catch (err) {
      apply(previous); // revert on failure
      toast.error(err instanceof ApiError ? err.message : 'Could not reorder images');
    }
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  }
```

- [ ] **Step 2: Make each gallery tile draggable**

In the gallery `map`, change the tile wrapper `<div key={img.id} …>` to add drag props:
```tsx
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className="group relative cursor-move overflow-hidden rounded-lg border border-border"
            >
```
and update the `map` callback signature to expose the index: `{images.map((img, index) => (`.

- [ ] **Step 3: Verify build**

Run: `cd magnetrip-web && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd magnetrip-web && git add components/trips/image-manager.tsx && git commit -m "feat(editor): drag-to-reorder trip images"
```

---

## Task 8: Manual verification pass (controller/human)

**Files:** none (verification).

> Run by the controller/human against the running app + live Supabase, using the seeded test user (or any account). Pages are client-rendered and mutate live data, so this replaces automated e2e (none configured).

- [ ] **Step 1: Start the app**

Run: `cd magnetrip-web && pnpm dev` (ensure the Supabase Auth Redirect URLs include `http://localhost:3000/**`, per Phase 2a).

- [ ] **Step 2: Walk the flows and confirm each**

1. Sign in → `/dashboard`. With no trips → the "No trips yet" empty state + a working **New trip** button.
2. Create a trip → lands on `/trips/{id}/edit`. Edit name/year/description → **Save changes** → success toast; reload shows persisted values.
3. Add images (multi-select) → they appear in the gallery; a spinner shows during upload; images render via `next/image` from the Supabase public URL.
4. Set a cover → "Cover" badge moves; return to `/dashboard` → the card shows that cover.
5. Drag to reorder images → order persists across reload.
6. Delete an image → it disappears; deleting the cover clears the cover.
7. On `/dashboard`, a card's ⋮ menu: **Edit** navigates to the editor; **Show public page** opens `/t/{publicId}` in a new tab (will 404 until Phase 3 — expected); **Copy public link** copies the URL (toast) and the clipboard holds `https://magnetrip-web.vercel.app/t/{publicId}`; **Delete** → confirm dialog → card removed + toast.
8. Loading: throttle network (or hard-reload) → dashboard shows skeletons, editor shows skeletons.
9. Error: temporarily point the app at a bad Supabase URL (or sign out mid-session) → dashboard/editor show the error box with a working **Try again**.
10. Responsive: at mobile width the grid is 1 column, cards/menus usable; tablet 2 cols; desktop 3.
11. Auth guard: while signed out, visiting `/trips/<any-id>/edit` redirects to `/login?next=/trips/<id>/edit` (confirms Task 1).

- [ ] **Step 3: Record results**

Note pass/fail per step in the task report. Any failure → fix in the relevant component and re-verify.

---

## Definition of Done (Phase 2c)

- `pnpm test` passes (route-guard + format helpers; existing suite still green).
- `pnpm build` + `tsc --noEmit` clean; `/trips/[id]/edit` present.
- `/trips/*` is protected by the middleware (Task 1 test).
- Manual pass (Task 8) green: dashboard list/loading/empty/error + create/delete/copy-link/show-public; editor details save; image upload/set-cover/delete/reorder; responsive; auth guard on the editor route.
- No page imports `supabase-js` for DB data (only `lib/trips/upload.ts` uses it for the storage byte upload; DB rows go via `apiClient`).

## Follow-up

- **Phase 3 — Public page + deploy verification:** `app/t/[publicId]/page.tsx` (Server Component, no auth) rendering name/year/description + a responsive image gallery from `getPublicTrip`; polished + lazy-loaded; verify the live Vercel URL end-to-end (this is what NFC tags point to). Then Flutter phases (2d/foundation + NFC).
- Deferred hardening still open: `updateSession` try/catch (middleware resilience); surface `?error=auth_callback` on login; relocate `uploads/sign`'s inline schema into `lib/validation`.
