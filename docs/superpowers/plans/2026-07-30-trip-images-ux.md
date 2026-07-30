# Trip Images UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cover assignment feel instant, put a confirmation in front of image deletion, add
multi-select bulk delete backed by a real batch endpoint, and open public-page photos in an enlarged
modal viewer.

**Architecture:** Client changes are concentrated in two components (`ImageManager` for the editor,
`TripGallery` for the public page), each gaining one new child component. The cover rule stays a
single pure function shared by client and server. Bulk delete adds one route → one service function,
following the existing thin-handler → service → RLS-scoped Supabase client chain.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 with generated
design tokens, base-ui + shadcn-style primitives in `components/ui/`, embla carousel, Zod v4,
Supabase (Postgres + Storage + RLS), sonner toasts, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-07-30-trip-images-ux-design.md`

## Global Constraints

- **No new tests.** The requester explicitly excluded them. Do not add `.test.ts` files. The
  existing suite must stay green: **14 files, 53 tests passing**.
- **Pre-existing lint state — do not try to "fix" these.** `pnpm lint` already fails on `main` with
  **4 errors, 2 warnings**, all `react-hooks/set-state-in-effect` plus two unused imports, in
  `app/(app)/dashboard/page.tsx:29`, `app/(app)/trips/[id]/edit/page.tsx:33`,
  `components/ui/carousel.tsx:98`, `hooks/use-mobile.ts:14`, `lib/env.test.ts:1`. Your job is to add
  **zero new** lint problems. Verify per-file with `pnpm exec eslint <path>`, which must be clean.
- **Never call `setState` synchronously in an effect body** — that is the rule already failing above,
  and new violations are indistinguishable from the existing ones. Subscribe to events inside
  effects instead.
- **No `supabase-js` imports in components.** Pages and components reach data only through
  `lib/api-client`. This is a hard rule from `CLAUDE.md`.
- **No hardcoded colors, spacing, or radii.** Use semantic token classes only (`bg-primary`,
  `text-muted-foreground`, `ring-ring/50`, `bg-foreground/60`, `rounded-lg`). `design/tokens.json`
  is not modified, so **do not run `pnpm tokens`**.
- **Files kebab-case, React components PascalCase, functions camelCase.**
- **Commits are Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`).
- **Branch:** all work lands on `feat/trip-images-ux`, which already exists and holds the spec commit.
- **Mobile floor is 360px wide.** Every control group added must wrap rather than overflow.

---

## File Structure

**Modified**

| File | Responsibility after this plan |
| --- | --- |
| `lib/trips/cover.ts` | The one place the cover-selection rule lives; gains the many-ids case |
| `lib/validation/trip.ts` | Adds `bulkDeleteImagesSchema` |
| `lib/services/images.service.ts` | Adds `deleteImages()` — batch delete + single cover recompute |
| `lib/api-client/index.ts` | Adds `bulkDeleteImages()` |
| `components/ui/dialog.tsx` | Adds an `overlayClassName` passthrough so a lightbox can darken the backdrop |
| `components/trips/image-manager.tsx` | Optimistic cover, select mode, delete confirmation wiring |
| `components/public/trip-gallery.tsx` | Client component; clickable thumbnails; hosts the lightbox |

**Created**

| File | Responsibility |
| --- | --- |
| `components/trips/delete-images-dialog.tsx` | Confirmation UI only, for both 1 and N images. Runs no mutation. |
| `components/public/trip-lightbox.tsx` | Modal photo viewer: carousel, counter, close button |
| `app/api/trips/[id]/images/bulk-delete/route.ts` | Thin POST handler → `deleteImages()` |

Task order matters: **Task 2 → Task 3** (endpoint needs the shared rule) and
**Task 4 → Task 5** (select mode reuses the confirmation dialog), **Task 6 → Task 7** (lightbox needs
the overlay prop).

---

## Task 1: Make cover assignment instant

**Files:**
- Modify: `components/trips/image-manager.tsx:71-79`

**Interfaces:**
- Consumes: existing `emit(nextImages, nextCover)` helper at `image-manager.tsx:29-33`
- Produces: nothing new for later tasks

**Why:** `setCover` awaits the PATCH before touching local state, so the `Cover` badge lags by a
round-trip. `persistOrder` directly below it (lines 81-90) already uses the correct
optimistic-then-revert shape. This makes `setCover` match its neighbour.

- [ ] **Step 1: Replace the `setCover` function**

Find this exact function in `components/trips/image-manager.tsx`:

```tsx
  async function setCover(imageId: string) {
    try {
      const updated = await apiClient.updateTrip(trip.id, { coverImageId: imageId });
      emit(images, updated.coverImageId);
      toast.success('Cover updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not set the cover');
    }
  }
```

Replace it with:

```tsx
  // Optimistic, mirroring persistOrder below: the badge has to move on the click,
  // so the PATCH result only ever reconciles or reverts.
  async function setCover(imageId: string) {
    const previous = coverId;
    if (previous === imageId) return;
    emit(images, imageId);
    try {
      const updated = await apiClient.updateTrip(trip.id, { coverImageId: imageId });
      if (updated.coverImageId !== imageId) emit(images, updated.coverImageId);
      toast.success('Cover updated');
    } catch (err) {
      emit(images, previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not set the cover');
    }
  }
```

- [ ] **Step 2: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/trips/image-manager.tsx
```
Expected: both silent, exit 0.

- [ ] **Step 3: Confirm the existing suite still passes**

Run: `pnpm test`
Expected: `Test Files 14 passed (14)`, `Tests 53 passed (53)`.

- [ ] **Step 4: Verify by hand**

Run `pnpm dev`, open a trip with at least 2 images at `/trips/<id>/edit`, hover a non-cover image and
click the star.
Expected: the `Cover` badge jumps to that tile with no perceptible pause, and the `Cover updated`
toast follows shortly after.

- [ ] **Step 5: Commit**

```bash
git add components/trips/image-manager.tsx
git commit -m "fix(trips): move the cover badge optimistically on click"
```

---

## Task 2: Generalize the shared cover rule

**Files:**
- Modify: `lib/trips/cover.ts`

**Interfaces:**
- Consumes: the existing module-local `Positioned` type (`{ id: string; position: number }`)
- Produces: `coverAfterDeleteMany(coverImageId: string | null, deletedIds: string[], remaining: Positioned[]): string | null`.
  Task 3 (service) and Task 5 (client) both import it. `coverAfterDelete` keeps its exact current
  signature and behaviour, so existing callers in `lib/services/images.service.ts` are untouched.

**Why:** Bulk delete needs "was the cover anywhere in this set?". The file's own header comment says
the API and the client must not drift apart, so the general case goes here and the single-id
function becomes a delegate rather than a second copy of the logic.

- [ ] **Step 1: Replace the `coverAfterDelete` function**

Find this exact block at the end of `lib/trips/cover.ts`:

```ts
/**
 * Deleting the cover promotes the lowest-position survivor (null when none are left).
 * Deleting any other image leaves the cover alone.
 */
export function coverAfterDelete(
  coverImageId: string | null,
  deletedId: string,
  remaining: Positioned[],
): string | null {
  if (coverImageId !== deletedId) return coverImageId;
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.position - b.position)[0].id;
}
```

Replace it with:

```ts
/**
 * Deleting the cover promotes the lowest-position survivor (null when none are left).
 * Deleting any other image leaves the cover alone.
 */
export function coverAfterDeleteMany(
  coverImageId: string | null,
  deletedIds: string[],
  remaining: Positioned[],
): string | null {
  if (coverImageId === null || !deletedIds.includes(coverImageId)) return coverImageId;
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.position - b.position)[0].id;
}

/** The single-image case of {@link coverAfterDeleteMany}. */
export function coverAfterDelete(
  coverImageId: string | null,
  deletedId: string,
  remaining: Positioned[],
): string | null {
  return coverAfterDeleteMany(coverImageId, [deletedId], remaining);
}
```

- [ ] **Step 2: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint lib/trips/cover.ts
```
Expected: both silent, exit 0.

- [ ] **Step 3: Confirm no behaviour changed**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`. Any failure here means the delegation changed behaviour — the
`coverImageId === null` early exit is the only new branch, and it is equivalent because a `null`
cover was never equal to a real `deletedId` string.

- [ ] **Step 4: Commit**

```bash
git add lib/trips/cover.ts
git commit -m "refactor(trips): generalize the cover rule to many deleted ids"
```

---

## Task 3: Batch delete endpoint

**Files:**
- Modify: `lib/validation/trip.ts`
- Modify: `lib/services/images.service.ts`
- Create: `app/api/trips/[id]/images/bulk-delete/route.ts`
- Modify: `lib/api-client/index.ts`

**Interfaces:**
- Consumes: `coverAfterDeleteMany` from Task 2; the file-private `readCover` and `writeCover` helpers
  already in `images.service.ts`; `route`, `parseBody`, `RouteCtx` from `lib/api/route`;
  `resolveApiContext` from `lib/api/auth`; `ServiceError` from `lib/services/errors`.
- Produces:
  - `bulkDeleteImagesSchema` (Zod object `{ imageIds: string[] }`)
  - `deleteImages(supabase: SupabaseClient, tripId: string, imageIds: string[]): Promise<number>`
  - `POST /api/trips/:id/images/bulk-delete` → `200 { deleted: number }`
  - `apiClient.bulkDeleteImages(tripId: string, imageIds: string[]): Promise<{ deleted: number }>`
    — Task 5 calls exactly this.

**Why POST:** request bodies on `DELETE` are inconsistently supported across fetch and proxy layers.
`reorder` already establishes the precedent of a verb-named sub-path under `images/`.

- [ ] **Step 1: Add the validation schema**

In `lib/validation/trip.ts`, immediately after the existing `reorderImagesSchema`, add:

```ts
export const bulkDeleteImagesSchema = z.object({
  imageIds: z
    .array(z.string().uuid())
    .min(1)
    .max(100)
    // Duplicates would make the service's found-count check fail spuriously.
    .refine((ids) => new Set(ids).size === ids.length, 'Image list contains duplicates'),
});
```

- [ ] **Step 2: Add the service function**

In `lib/services/images.service.ts`, change the cover import on line 4 from:

```ts
import { coverAfterAdd, coverAfterDelete } from '@/lib/trips/cover';
```

to:

```ts
import { coverAfterAdd, coverAfterDelete, coverAfterDeleteMany } from '@/lib/trips/cover';
```

Then append this function to the end of the file (after the existing `deleteImage`):

```ts
/**
 * Deletes several images belonging to one trip in a single pass: one row delete,
 * at most one cover recompute, one storage removal. Returns how many were deleted.
 */
export async function deleteImages(
  supabase: SupabaseClient,
  tripId: string,
  imageIds: string[],
): Promise<number> {
  // RLS: these rows come back only when the caller owns the parent trip, so a
  // short count means an id was foreign or already gone.
  const { data: rows, error } = await supabase
    .from('trip_images')
    .select('id, storage_path')
    .eq('trip_id', tripId)
    .in('id', imageIds);
  if (error) throw new ServiceError('internal', error.message);
  const found = (rows ?? []) as { id: string; storage_path: string }[];
  if (found.length !== imageIds.length) {
    throw new ServiceError('not_found', 'One or more images were not found');
  }

  // Read the cover before the delete: the FK nulls the column on the way out,
  // so afterwards there is no way to tell whether one of these was the cover.
  const cover = await readCover(supabase, tripId);

  const { error: delErr } = await supabase
    .from('trip_images').delete().eq('trip_id', tripId).in('id', imageIds);
  if (delErr) throw new ServiceError('internal', delErr.message);

  if (cover !== undefined && cover !== null && imageIds.includes(cover)) {
    const { data: restRows, error: restErr } = await supabase
      .from('trip_images').select('id, position').eq('trip_id', tripId);
    if (restErr) {
      console.error('Failed to promote a new trip cover image:', restErr.message);
    } else {
      const remaining = (restRows ?? []) as { id: string; position: number }[];
      // null needs no write — the FK already cleared it.
      await writeCover(supabase, tripId, null, coverAfterDeleteMany(cover, imageIds, remaining));
    }
  }

  const { error: removeErr } = await supabase.storage
    .from('trip-images')
    .remove(found.map((r) => r.storage_path));
  if (removeErr) {
    console.error('Failed to remove trip images from storage:', removeErr.message);
  }

  return found.length;
}
```

- [ ] **Step 3: Create the route**

Create `app/api/trips/[id]/images/bulk-delete/route.ts` with exactly:

```ts
import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { bulkDeleteImagesSchema } from '@/lib/validation/trip';
import { deleteImages } from '@/lib/services/images.service';

export const POST = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const { imageIds } = await parseBody(request, bulkDeleteImagesSchema);
  const deleted = await deleteImages(supabase, id, imageIds);
  return NextResponse.json({ deleted });
});
```

- [ ] **Step 4: Add the api-client method**

In `lib/api-client/index.ts`, immediately after the existing `deleteImage` line inside the
`apiClient` object, add:

```ts
  bulkDeleteImages: (tripId: string, imageIds: string[]) =>
    request<{ deleted: number }>(`/api/trips/${tripId}/images/bulk-delete`, { method: 'POST', body: { imageIds } }),
```

- [ ] **Step 5: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint lib/validation/trip.ts lib/services/images.service.ts lib/api-client/index.ts 'app/api/trips/[id]/images/bulk-delete/route.ts'
```
Expected: both silent, exit 0.

- [ ] **Step 6: Confirm the existing suite still passes**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`.

- [ ] **Step 7: Verify the endpoint answers**

With `pnpm dev` running and logged in, open the browser devtools console on `/trips/<id>/edit` and run:

```js
await fetch(`/api/trips/${location.pathname.split('/')[2]}/images/bulk-delete`, {
  method: 'POST', credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ imageIds: ['00000000-0000-0000-0000-000000000000'] }),
}).then((r) => [r.status, r.json()]);
```
Expected: status `404` and body `{ error: "One or more images were not found" }` — this proves the
route resolves, auth passes, validation passes, and the ownership check bites. Do **not** test the
success path here; Task 5 exercises it through the UI.

- [ ] **Step 8: Commit**

```bash
git add lib/validation/trip.ts lib/services/images.service.ts lib/api-client/index.ts 'app/api/trips/[id]/images/bulk-delete/route.ts'
git commit -m "feat(api): add batch image delete endpoint"
```

---

## Task 4: Delete confirmation dialog, wired to single delete

**Files:**
- Create: `components/trips/delete-images-dialog.tsx`
- Modify: `components/trips/image-manager.tsx`

**Interfaces:**
- Consumes: `AlertDialog*` primitives from `components/ui/alert-dialog`; `coverAfterDeleteMany` from
  Task 2; `apiClient.deleteImage` (already exists).
- Produces: `DeleteImagesDialog` with props
  `{ count: number; coverAffected: boolean; open: boolean; onOpenChange: (open: boolean) => void; loading: boolean; onConfirm: () => void }`.
  Task 5 reuses it unchanged for the bulk case.
  Also produces the `pendingDelete: string[] | null` + `deleting: boolean` state and the
  `askDelete(ids)` / `confirmDelete()` functions inside `ImageManager`, which Task 5 builds on.

**Why the dialog runs no mutation** (unlike `delete-trip-dialog.tsx`, which calls the API itself):
`ImageManager` owns `images`/`coverId` and picks between the single and batch endpoints. Keeping the
dialog presentational is what lets one component serve both cases.

- [ ] **Step 1: Create the dialog component**

Create `components/trips/delete-images-dialog.tsx` with exactly:

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Confirmation for removing one or many trip images. Presentational only — the
 * caller owns the images state and decides which endpoint to hit.
 */
export function DeleteImagesDialog({
  count, coverAffected, open, onOpenChange, loading, onConfirm,
}: {
  count: number;
  coverAffected: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: () => void;
}) {
  const single = count === 1;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single ? 'Delete this image?' : `Delete ${count} images?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single
              ? 'This permanently removes the photo from your trip. This cannot be undone.'
              : `This permanently removes ${count} photos from your trip. This cannot be undone.`}
            {coverAffected ? ' The trip cover will move to the next photo.' : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={loading}
          >
            {loading ? 'Deleting…' : single ? 'Delete' : `Delete ${count}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Swap `ImageManager`'s cover import**

In `components/trips/image-manager.tsx`, change line 8 from:

```tsx
import { coverAfterAdd, coverAfterDelete } from '@/lib/trips/cover';
```

to:

```tsx
import { coverAfterAdd, coverAfterDeleteMany } from '@/lib/trips/cover';
```

- [ ] **Step 3: Add the dialog import**

Add this import alongside the other `@/components` imports in `image-manager.tsx`:

```tsx
import { DeleteImagesDialog } from '@/components/trips/delete-images-dialog';
```

- [ ] **Step 4: Replace `remove()` with the confirmation flow**

The existing `import { useRef, useState } from 'react';` on line 3 already covers what this task
needs — `useRef` stays because `inputRef` uses it. Task 5 adds `useEffect`.

Delete this entire existing function from `image-manager.tsx`:

```tsx
  async function remove(imageId: string) {
    try {
      await apiClient.deleteImage(imageId);
      const rest = images.filter((i) => i.id !== imageId);
      // deleteImage promotes the next image server-side; mirror that here.
      emit(rest, coverAfterDelete(coverId, imageId, rest));
      toast.success('Image removed');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove the image');
    }
  }
```

Add these two state declarations next to the existing ones (after `const [dragIndex, setDragIndex] = useState<number | null>(null);`):

```tsx
  // The ids awaiting confirmation; null means the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Held in state rather than derived from pendingDelete so the copy does not
  // flicker to the single-image wording during the dialog's close animation.
  const [deleteCount, setDeleteCount] = useState(1);
```

> **Corrected during execution.** An earlier draft of this plan held the count in a
> `useRef` and read `.current` during render. That trips `react-hooks/refs` in the
> repo's `eslint-plugin-react-hooks`, and the rule is right — reading a ref during
> render is not reactive. Use plain state as shown. Do not add an eslint suppression.

And add these two functions where `remove()` used to be:

```tsx
  function askDelete(ids: string[]) {
    if (ids.length === 0) return;
    setDeleteCount(ids.length);
    setPendingDelete(ids);
  }

  async function confirmDelete() {
    const ids = pendingDelete;
    if (ids === null || ids.length === 0) return;
    setDeleting(true);
    try {
      // One id still uses the single endpoint — it is cheaper and already proven.
      if (ids.length === 1) await apiClient.deleteImage(ids[0]);
      else await apiClient.bulkDeleteImages(trip.id, ids);
      const rest = images.filter((i) => !ids.includes(i.id));
      // Both endpoints promote a new cover server-side; mirror that here.
      emit(rest, coverAfterDeleteMany(coverId, ids, rest));
      toast.success(ids.length === 1 ? 'Image removed' : `${ids.length} images removed`);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : ids.length === 1
            ? 'Could not remove the image'
            : 'Could not remove the images',
      );
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }
```

- [ ] **Step 5: Point the per-tile trash button at the dialog**

In the tile overlay, change:

```tsx
                <Button type="button" size="icon" variant="destructive" aria-label="Delete image"
                  disabled={uploading} onClick={() => void remove(img.id)}><Trash2 className="size-4" /></Button>
```

to:

```tsx
                <Button type="button" size="icon" variant="destructive" aria-label="Delete image"
                  disabled={uploading} onClick={() => askDelete([img.id])}><Trash2 className="size-4" /></Button>
```

- [ ] **Step 6: Render the dialog**

Immediately before the closing `</section>` tag of `ImageManager`'s returned JSX, add:

```tsx
      <DeleteImagesDialog
        count={deleteCount}
        coverAffected={coverId !== null && (pendingDelete?.includes(coverId) ?? false)}
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
```

- [ ] **Step 7: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/trips/image-manager.tsx components/trips/delete-images-dialog.tsx
```
Expected: both silent, exit 0. If `tsc` reports `coverAfterDelete` is unused or missing, Step 2 was skipped.

- [ ] **Step 8: Confirm the existing suite still passes**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`.

- [ ] **Step 9: Verify by hand**

With `pnpm dev`, on `/trips/<id>/edit` with 2+ images:
1. Hover a non-cover image, click the trash. Expected: dialog reading "Delete this image?" with the
   cover sentence absent.
2. Click Cancel. Expected: dialog closes, image still there.
3. Click the trash on the **cover** image. Expected: description ends with "The trip cover will move
   to the next photo."
4. Click Delete. Expected: button shows "Deleting…", then the tile disappears, the `Cover` badge
   moves to another tile, and an "Image removed" toast appears.
5. Reload the page. Expected: the deletion and the new cover both persisted.

- [ ] **Step 10: Commit**

```bash
git add components/trips/image-manager.tsx components/trips/delete-images-dialog.tsx
git commit -m "feat(trips): confirm before deleting a trip image"
```

---

## Task 5: Multi-select mode and bulk delete

**Files:**
- Modify: `components/trips/image-manager.tsx`

**Interfaces:**
- Consumes: `askDelete(ids)`, `confirmDelete()`, `pendingDelete`, `deleting` from Task 4;
  `apiClient.bulkDeleteImages` from Task 3 (already called inside `confirmDelete`, so no new call
  site is needed); `cn` from `@/lib/utils`.
- Produces: nothing later tasks depend on.

**Why an explicit header button** rather than tapping or long-pressing a tile: tiles are already
`draggable` for reordering, and a tap/long-press selector would compete with the drag gesture.

- [ ] **Step 1: Update the imports**

Change line 3 of `components/trips/image-manager.tsx` from:

```tsx
import { useRef, useState } from 'react';
```

to:

```tsx
import { useEffect, useRef, useState } from 'react';
```

Change the lucide import from:

```tsx
import { ImagePlus, Star, Trash2 } from 'lucide-react';
```

to:

```tsx
import { Check, ImagePlus, SquareCheckBig, Star, Trash2 } from 'lucide-react';
```

Add:

```tsx
import { cn } from '@/lib/utils';
```

- [ ] **Step 2: Add select-mode state and helpers**

Next to the other `useState` calls, add:

```tsx
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
```

Then add these helpers below the existing `emit` function:

```tsx
  const allSelected = images.length > 0 && selected.length === images.length;

  function exitSelectMode() {
    setSelectMode(false);
    setSelected([]);
  }

  function toggleOne(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleSelectAll() {
    setSelected(allSelected ? [] : images.map((i) => i.id));
  }
```

- [ ] **Step 3: Add the Escape handler**

Add this effect after the helpers. Note it only *subscribes* — it never calls `setState` in the
effect body, which would trip `react-hooks/set-state-in-effect`:

```tsx
  // Escape leaves select mode, but not while the confirmation dialog is open —
  // there, Escape belongs to the dialog.
  useEffect(() => {
    if (!selectMode || pendingDelete !== null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') exitSelectMode();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectMode, pendingDelete]);
```

- [ ] **Step 4: Leave select mode after a successful delete**

In `confirmDelete` from Task 4, add `exitSelectMode();` as the last statement of the `try` block,
immediately after the `toast.success(...)` line:

```tsx
      toast.success(ids.length === 1 ? 'Image removed' : `${ids.length} images removed`);
      exitSelectMode();
```

This also covers "all images deleted" — the grid unmounts and select mode is already off.

- [ ] **Step 5: Replace the header**

Replace this entire existing block:

```tsx
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Images</h2>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Spinner /> : <ImagePlus className="size-4" />} Add images
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      </div>
```

with:

```tsx
      {/* flex-wrap so four controls wrap to a second line at 360px instead of overflowing */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selectMode ? (
          <>
            <h2 className="text-lg font-semibold" aria-live="polite">
              {selected.length} selected
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleSelectAll} disabled={deleting}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </Button>
              <Button variant="destructive" size="sm" disabled={selected.length === 0 || deleting}
                onClick={() => askDelete(selected)}>
                <Trash2 className="size-4" /> Delete ({selected.length})
              </Button>
              <Button variant="ghost" size="sm" onClick={exitSelectMode} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Images</h2>
            <div className="flex flex-wrap items-center gap-2">
              {images.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} disabled={uploading}>
                  <SquareCheckBig className="size-4" /> Select
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner /> : <ImagePlus className="size-4" />} Add images
              </Button>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      </div>
```

- [ ] **Step 6: Replace the tile**

Replace the entire existing `{images.map((img, index) => ( ... ))}` block — everything from
`{images.map(` to its closing `))}` — with this. Note the callback now uses a `{ return ... }` body
so it can compute `isSelected`:

```tsx
          {images.map((img, index) => {
            const isSelected = selected.includes(img.id);
            return (
              <div
                key={img.id}
                draggable={!uploading && !selectMode}
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                onClick={selectMode ? () => toggleOne(img.id) : undefined}
                onKeyDown={selectMode ? (e) => {
                  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOne(img.id); }
                } : undefined}
                role={selectMode ? 'checkbox' : undefined}
                aria-checked={selectMode ? isSelected : undefined}
                aria-label={selectMode ? `Photo ${index + 1}` : undefined}
                tabIndex={selectMode ? 0 : undefined}
                className={cn(
                  'group relative overflow-hidden rounded-lg border border-border outline-none',
                  selectMode ? 'cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50' : 'cursor-move',
                  isSelected && 'ring-2 ring-primary',
                )}
              >
                <AspectRatio ratio={1}>
                  <Image src={img.url} alt={`Trip photo ${index + 1}`} fill sizes="33vw"
                    className={cn('object-cover transition-opacity', selectMode && !isSelected && 'opacity-70')} />
                </AspectRatio>
                {coverId === img.id ? (
                  <Badge className="absolute left-2 top-2">Cover</Badge>
                ) : null}
                {selectMode ? (
                  /* Plain indicator rather than <Checkbox>: nesting a checkbox widget
                     inside role="checkbox" is invalid, and this reads better over a photo.
                     Top-right so it never collides with the Cover badge. */
                  <span aria-hidden className={cn(
                    'absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 border-background/80 shadow-sm transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-foreground/25',
                  )}>
                    {isSelected ? <Check className="size-4" /> : null}
                  </span>
                ) : (
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-foreground/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <Button type="button" size="icon" variant="secondary" aria-label="Set as cover"
                      disabled={uploading} onClick={() => void setCover(img.id)}><Star className="size-4" /></Button>
                    <Button type="button" size="icon" variant="destructive" aria-label="Delete image"
                      disabled={uploading} onClick={() => askDelete([img.id])}><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </div>
            );
          })}
```

- [ ] **Step 7: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/trips/image-manager.tsx
```
Expected: both silent, exit 0. In particular eslint must **not** report a new
`react-hooks/set-state-in-effect` — if it does, the Escape effect is calling state setters directly
in its body rather than inside `onKeyDown`.

- [ ] **Step 8: Confirm the existing suite still passes**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`.

- [ ] **Step 9: Verify by hand — desktop**

With `pnpm dev`, on `/trips/<id>/edit` with 4+ images:
1. Click `Select`. Expected: header becomes "0 selected" with Select all / Delete (0) / Cancel;
   `Delete (0)` disabled; tiles dim slightly; hover no longer shows star/trash.
2. Click two tiles. Expected: each gets a teal ring and a filled check top-right; header reads
   "2 selected"; `Delete (2)` enabled.
3. Click `Select all` → all selected, label flips to `Deselect all`. Click it → none selected.
4. Try dragging a tile. Expected: nothing moves (reorder is off in select mode).
5. Press Escape. Expected: select mode exits, star/trash return on hover, dragging reorders again.
6. Re-enter select mode, select the **cover** plus one other, click `Delete (2)`. Expected: dialog
   reads "Delete 2 images?" and mentions the cover moving. Confirm. Expected: both tiles vanish, the
   `Cover` badge appears on a survivor, toast reads "2 images removed", select mode exits.
7. Reload. Expected: both deletions and the new cover persisted.
8. Re-enter select mode, `Select all`, delete everything. Expected: the empty-state text returns and
   the `Select` button is gone.

- [ ] **Step 10: Verify by hand — mobile and keyboard**

1. In devtools set the viewport to **360×640**. Enter select mode. Expected: the four controls wrap
   onto additional lines; nothing is clipped and the page does not scroll sideways.
2. Tap tiles to select. Expected: selection toggles on tap.
3. Back on desktop, enter select mode and press Tab. Expected: focus ring lands on tiles; Space and
   Enter each toggle selection.

- [ ] **Step 11: Commit**

```bash
git add components/trips/image-manager.tsx
git commit -m "feat(trips): select multiple images and delete them at once"
```

---

## Task 6: Let a dialog override its overlay

**Files:**
- Modify: `components/ui/dialog.tsx:42-61`

**Interfaces:**
- Produces: `DialogContent` accepts an optional `overlayClassName?: string`, forwarded to
  `DialogOverlay`. Task 7 passes it. Omitting it leaves current behaviour byte-for-byte identical,
  so no existing dialog changes appearance.

**Why:** `DialogContent` hardcodes `<DialogOverlay />`, whose `bg-black/10 backdrop-blur-xs` is far
too light to sit behind a full-screen photo.

- [ ] **Step 1: Add the prop**

In `components/ui/dialog.tsx`, change:

```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
```

to:

```tsx
function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  overlayClassName?: string
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
```

- [ ] **Step 2: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/ui/dialog.tsx
```
Expected: both silent, exit 0.

- [ ] **Step 3: Verify nothing regressed**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`.

Then with `pnpm dev`, open the "New trip" dialog from `/dashboard`.
Expected: it looks exactly as before — same light backdrop, same blur.

- [ ] **Step 4: Commit**

```bash
git add components/ui/dialog.tsx
git commit -m "feat(ui): allow DialogContent to restyle its overlay"
```

---

## Task 7: Public page photo lightbox

**Files:**
- Create: `components/public/trip-lightbox.tsx`
- Modify: `components/public/trip-gallery.tsx`

**Interfaces:**
- Consumes: `overlayClassName` from Task 6; `Carousel`, `CarouselContent`, `CarouselItem`,
  `CarouselNext`, `CarouselPrevious`, `type CarouselApi` from `components/ui/carousel`;
  `Dialog`, `DialogClose`, `DialogContent`, `DialogTitle` from `components/ui/dialog`.
- Produces: `TripLightbox` with props
  `{ images: { url: string }[]; alt: string; openIndex: number; onClose: () => void }`.

**Two constraints that are easy to get wrong:**
1. **The close button must be rendered inside `<Carousel>`.** `Carousel` binds its arrow-key handler
   with `onKeyDownCapture` on its own root div (`components/ui/carousel.tsx:122`), so key events only
   reach it from descendants. `Dialog` autofocuses the first focusable element — the close button —
   so placing it outside the carousel would silently break ←/→.
2. **`CarouselPrevious`/`CarouselNext` default to `-left-12`/`-right-12`**, i.e. outside the content
   box. In a near-full-width lightbox that is off-screen, so both need `left-3`/`right-3` overrides.

- [ ] **Step 1: Create the lightbox**

Create `components/public/trip-lightbox.tsx` with exactly:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Enlarged photo viewer. Mounted only while open and keyed on the opening index,
 * so `startIndex` and the counter are always in step.
 */
export function TripLightbox({
  images, alt, openIndex, onClose,
}: {
  images: { url: string }[];
  alt: string;
  openIndex: number;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(openIndex);

  // Subscribe only. The initial value already comes from `startIndex`, so there is
  // no need to setState in the effect body (which react-hooks lint forbids).
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-foreground/90 supports-backdrop-filter:backdrop-blur-sm"
        className="w-[min(96vw,1200px)] max-w-none gap-3 border-0 bg-transparent p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt} — photo viewer</DialogTitle>
        <Carousel opts={{ startIndex: openIndex, loop: false }} setApi={setApi} className="w-full">
          {/* Inside <Carousel> on purpose: Dialog autofocuses this button, and the
              carousel only sees arrow keys from its own descendants. */}
          <DialogClose
            render={<Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 rounded-full" />}
          >
            <X />
            <span className="sr-only">Close</span>
          </DialogClose>
          <CarouselContent>
            {images.map((img, i) => (
              <CarouselItem key={`${img.url}-${i}`}>
                <div className="relative h-[80svh] w-full">
                  <Image
                    src={img.url}
                    alt={`${alt} — photo ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 90vw"
                    priority={i === openIndex}
                    className="object-contain"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* Hidden below sm: swipe is the right gesture on a phone, and arrows
              would just sit on top of the photo. left-3/right-3 override the
              primitive's -left-12/-right-12, which is off-screen at this width. */}
          <CarouselPrevious variant="secondary" className="left-3 hidden sm:flex" />
          <CarouselNext variant="secondary" className="right-3 hidden sm:flex" />
        </Carousel>
        {images.length > 1 ? (
          <p className="mx-auto rounded-full bg-foreground/60 px-3 py-1 text-xs font-medium text-background">
            {current + 1} / {images.length}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Rewrite the gallery**

Replace the entire contents of `components/public/trip-gallery.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TripLightbox } from '@/components/public/trip-lightbox';

export function TripGallery({
  images,
  alt,
}: {
  images: { url: string; position: number }[];
  alt: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No photos yet.
      </div>
    );
  }
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            aria-label={`Open photo ${i + 1} of ${sorted.length}`}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-muted outline-none transition-transform hover:scale-[1.02] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Image
              src={img.url}
              alt={`${alt} — photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              loading="lazy"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {/* Keyed on openIndex so every open remounts with a matching startIndex. */}
      {openIndex !== null ? (
        <TripLightbox
          key={openIndex}
          images={sorted}
          alt={alt}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}
```

Note: `TripGallery` is now a client component but is still server-rendered, so the `<img>` tags stay
in the initial HTML and SEO/LCP are unaffected. `app/t/[publicId]/page.tsx` needs no change — it
already passes exactly `images` and `alt`.

- [ ] **Step 3: Typecheck and lint**

Run:
```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/public/trip-gallery.tsx components/public/trip-lightbox.tsx
```
Expected: both silent, exit 0. A new `react-hooks/set-state-in-effect` here means the effect is
calling `setCurrent` in its body instead of inside `onSelect`.

- [ ] **Step 4: Confirm the existing suite still passes**

Run: `pnpm test`
Expected: `Tests 53 passed (53)`.

- [ ] **Step 5: Verify by hand — desktop**

With `pnpm dev`, open a public trip page at `/t/<publicId>` that has 3+ photos:
1. Hover a thumbnail. Expected: zoom-in cursor and a slight scale-up.
2. Click the 2nd photo. Expected: modal opens on **that** photo, dark backdrop, whole photo visible
   and uncropped, counter reads `2 / N`.
3. Click the right arrow. Expected: next photo, counter increments.
4. Press → and ←. Expected: navigation works and the counter tracks it.
5. Press Escape. Expected: closes. Click a thumbnail again, click the X. Expected: closes. Open
   again, click the backdrop. Expected: closes.
6. Open the **first** photo. Expected: left arrow is disabled. Open the last. Expected: right arrow
   is disabled (`loop: false`).
7. Tab through the open modal. Expected: focus is trapped inside and the X has a visible focus ring.

- [ ] **Step 6: Verify by hand — mobile**

In devtools set the viewport to **360×640** and reload `/t/<publicId>`:
1. Tap a photo. Expected: modal opens, no horizontal page scroll, photo fits.
2. Expected: **no** arrow buttons at this width.
3. Swipe left and right. Expected: photos change, counter tracks.
4. Tap the X. Expected: closes.
5. Also check a trip with exactly **one** photo. Expected: modal opens, no counter pill, no arrows.

- [ ] **Step 7: Commit**

```bash
git add components/public/trip-gallery.tsx components/public/trip-lightbox.tsx
git commit -m "feat(public): open trip photos in an enlarged modal viewer"
```

---

## Task 8: Full verification

**Files:** none modified.

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: build succeeds. Confirm `/api/trips/[id]/images/bulk-delete` appears in the route list.
If the build complains that `trip-gallery.tsx` cannot be used as a Server Component, the `'use client'`
directive on line 1 is missing.

- [ ] **Step 2: Confirm no new lint problems**

Run: `pnpm lint`
Expected: still exactly **4 errors, 2 warnings** — the same pre-existing ones listed in Global
Constraints. Any additional problem, or any problem in a file this plan created, must be fixed.

- [ ] **Step 3: Confirm the suite is green**

Run: `pnpm test`
Expected: `Test Files 14 passed (14)`, `Tests 53 passed (53)`.

- [ ] **Step 4: End-to-end pass**

On a fresh trip: upload 4 photos → confirm the first became the cover → set a different cover and
confirm it moves instantly → multi-select two (including the cover) and bulk delete → confirm the
cover moved and the count toast was right → open the public page and page through the lightbox on
both a 360px and a desktop viewport → reload both pages and confirm every change persisted.

- [ ] **Step 5: Confirm storage was actually cleaned up**

Bulk delete removes storage objects best-effort and only logs on failure, so check it directly: in
the Supabase dashboard open Storage → `trip-images` → `<userId>/<tripId>/` and confirm the objects
for the bulk-deleted images are gone. Also check the `pnpm dev` terminal for any
`Failed to remove trip images from storage` line.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feat/trip-images-ux
```

---

## Notes and accepted trade-offs

- **The lightbox has no close animation.** It is keyed on `openIndex` and unmounts on close, which
  removes a whole class of stale-index bugs at the cost of the fade-out. Worth it.
- **`position` values stay gapped after deletion.** Single delete already behaves this way and only
  relative order is ever read. Renumbering was deliberately not added.
- **Bulk delete is not transactional.** Rows go in one statement, but a later storage removal failure
  leaves orphaned objects — logged, not thrown. This matches `deleteImage`'s existing behaviour;
  changing it is out of scope.
- **A sticky mobile action bar was considered and rejected** for select mode. Wrapping handles four
  controls at 360px without new layout machinery.

## Known follow-ups (recorded at completion, deliberately not fixed)

The final whole-branch review found two cross-task defects, both fixed in `8dac2cb`: the client
never renumbered `position` after a local reorder (so client and server promoted different covers
after deleting the cover), and `setCover`'s failure path restored a stale whole-array snapshot (so a
cover PATCH failing after a bulk delete resurrected the deleted images). The fix introduced
`latestImagesRef`/`latestCoverRef`, an `applyCover()` helper that no-ops on a vanished id, and a
sequence guard on `setCover`.

Four related items were reviewed and parked as not load-bearing:

1. `confirmDelete` computes the surviving list from its render closure after awaiting the delete —
   the same stale-closure class. Currently unreachable: in select mode nothing can mutate `images`
   during the await (Add is hidden, `draggable` is false, star/trash are not rendered, and the
   dialog is modal with its buttons disabled). If any of those change, switch it to
   `latestImagesRef.current`.
2. `onFiles` builds its next-list and cover from the render closure across a loop of awaits, so a
   delete landing mid-upload could re-add removed images. Pre-existing upload code.
3. Uploads assign `position: next.length` while deletes leave positional gaps, so a post-delete
   upload can tie an existing `position`. Client and server break such a tie by different rules
   (display order vs. unordered select). Pre-existing.
4. A failed delete closes the confirmation dialog, whereas `DeleteTripDialog` stays open for retry.
   The asymmetry is real; the spec's failure contract (error toast, selection preserved, still in
   select mode, nothing removed) is satisfied, and retry is one click away.
