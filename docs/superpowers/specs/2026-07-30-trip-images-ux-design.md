# Trip Images UX — Design

**Date:** 2026-07-30
**Scope:** Trip editor image management (instant cover, delete confirmation, multi-select bulk
delete) and the public trip page photo lightbox.

## Goals

1. Setting a cover image updates the UI on the click, not after the network round-trip.
2. Deleting an image asks for confirmation first.
3. The user can select several images and delete them in one action.
4. On the public page, clicking a photo opens it enlarged in a modal with an X close button.

Everything uses existing design tokens and works on mobile viewports down to 360px.

Out of scope: automated tests (explicitly excluded by the requester), reordering changes,
image editing, and any change to how uploads work.

## 1. Instant cover assignment

**Current behaviour.** `setCover()` in `components/trips/image-manager.tsx` awaits
`apiClient.updateTrip()` before calling `emit()`, so the `Cover` badge only moves once the PATCH
resolves. This reads as lag. `persistOrder()` in the same file already uses the correct
optimistic-then-revert pattern; `setCover` simply does not.

**Change.** Apply the local update first, then reconcile or revert:

```ts
async function setCover(imageId: string) {
  const previous = coverId;
  if (previous === imageId) return;
  emit(images, imageId);                       // badge moves immediately
  try {
    const updated = await apiClient.updateTrip(trip.id, { coverImageId: imageId });
    if (updated.coverImageId !== imageId) emit(images, updated.coverImageId);  // reconcile
  } catch (err) {
    emit(images, previous);                     // revert
    toast.error(err instanceof ApiError ? err.message : 'Could not set the cover');
  }
}
```

The `Cover updated` success toast stays: the badge move is the instant feedback, the toast confirms
persistence. Consistent with `remove()`, which also toasts on success.

## 2. Delete confirmation dialog

New component `components/trips/delete-images-dialog.tsx`, built on `AlertDialog`, following
`components/trips/delete-trip-dialog.tsx`.

**Deliberate difference from `DeleteTripDialog`:** this dialog does not perform the mutation.
`ImageManager` owns the `images` / `coverId` state and chooses between the single-image and bulk
endpoints, so the dialog stays pure confirmation UI.

Props:

| Prop | Type | Meaning |
| --- | --- | --- |
| `count` | `number` | How many images the confirmation covers (1 for single delete) |
| `coverAffected` | `boolean` | Whether the current cover is in the set |
| `open` / `onOpenChange` | `boolean` / `(open: boolean) => void` | Controlled visibility |
| `loading` | `boolean` | Disables both footer buttons while the request is in flight |
| `onConfirm` | `() => void` | Parent runs the delete |

Copy:

| Case | Title | Description |
| --- | --- | --- |
| `count === 1` | Delete this image? | This permanently removes the photo from your trip. This cannot be undone. |
| `count > 1` | Delete {count} images? | This permanently removes {count} photos from your trip. This cannot be undone. |
| `coverAffected` | — | Appended sentence: The trip cover will move to the next photo. |

The existing per-tile trash button opens this dialog with `count: 1` instead of deleting directly.

## 3. Multi-select and bulk delete

### Client state (`ImageManager`)

Three additions: `selectMode: boolean`, `selected: Set<string>`, `deleting: boolean`.

Select mode exits on Cancel, on Escape, after a successful bulk delete, and whenever `images`
becomes empty. Leaving select mode clears `selected`.

### Header

The header becomes `flex flex-wrap items-center justify-between gap-2` so it wraps to a second
line on narrow phones rather than overflowing.

```
idle          Images                        [ Select ]  [ + Add images ]
select mode   3 selected   [ Select all ]  [ Delete (3) ]  [ Cancel ]
```

- `Select` is hidden when `images.length === 0`.
- `Select all` becomes `Deselect all` once every image is selected.
- `Delete (n)` uses `variant="destructive"` and is disabled when `selected.size === 0`.
- A sticky bottom action bar was considered for mobile and rejected as unnecessary; wrapping is
  sufficient at these control counts.

### Tiles in select mode

- `draggable={false}` — reordering is off, so the drag gesture never competes with tapping to
  select. This is the reason select mode is entered from an explicit header button rather than by
  tapping or long-pressing a tile.
- Checkbox indicator sits **top-right**, so it never collides with the top-left `Cover` badge.
  It is `pointer-events-none`; the tile handles the click.
- Selected tiles get `ring-2 ring-primary`.
- The hover overlay holding the star and trash buttons is not rendered in select mode.
- The tile keeps its existing `div` and gains `role="checkbox"`, `aria-checked`, `tabIndex={0}`
  and Space/Enter handling. Rendering it as a `<button>` in select mode would mean duplicating
  the tile markup across two branches.

### Shared cover rule

`lib/trips/cover.ts` gains the general case, and the existing single-id function delegates to it,
so the client and the API keep exactly one copy of the rule:

```ts
export function coverAfterDeleteMany(
  coverImageId: string | null,
  deletedIds: string[],
  remaining: Positioned[],
): string | null {
  if (coverImageId === null || !deletedIds.includes(coverImageId)) return coverImageId;
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.position - b.position)[0].id;
}

export function coverAfterDelete(
  coverImageId: string | null,
  deletedId: string,
  remaining: Positioned[],
): string | null {
  return coverAfterDeleteMany(coverImageId, [deletedId], remaining);
}
```

`coverAfterDelete`'s signature and behaviour are unchanged, so existing callers and tests are
unaffected.

### Batch endpoint

`POST /api/trips/[id]/images/bulk-delete` — a new route file following
`app/api/trips/[id]/images/reorder/route.ts`. POST rather than DELETE-with-body, because request
bodies on DELETE are poorly supported across fetch and proxy layers.

Validation, in `lib/validation/trip.ts`:

```ts
export const bulkDeleteImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1).max(100),
});
```

Service `deleteImages(supabase, tripId, imageIds): Promise<number>` in
`lib/services/images.service.ts`:

1. Select `id, storage_path, position` from `trip_images` where `trip_id = tripId` and
   `id in imageIds`. RLS means rows come back only for trips the caller owns. A short count throws
   `ServiceError('not_found', 'One or more images were not found')`.
2. Read the current cover via the existing `readCover()` — the FK nulls the column on delete, so
   afterwards there is no way to tell whether a deleted image was the cover.
3. Delete all rows in one query: `.delete().eq('trip_id', tripId).in('id', imageIds)`.
4. If the cover was in the set, select the surviving `id, position` rows and call
   `writeCover(supabase, tripId, null, coverAfterDeleteMany(cover, imageIds, remaining))`.
   `previous` is `null` because the FK already cleared the column — same as `deleteImage()`.
5. Remove every storage object in one `storage.from('trip-images').remove(paths)` call. A failure
   here is logged, not thrown, matching `deleteImage()`.
6. Return the number of rows deleted.

Response: `200` with `{ deleted: number }`.

`lib/api-client/index.ts` gains:

```ts
bulkDeleteImages: (tripId: string, imageIds: string[]) =>
  request<{ deleted: number }>(`/api/trips/${tripId}/images/bulk-delete`,
    { method: 'POST', body: { imageIds } }),
```

### Bulk delete flow

1. `Delete (n)` opens `DeleteImagesDialog` with `count: selected.size` and
   `coverAffected: coverId !== null && selected.has(coverId)`.
2. Confirm sets `deleting`, then calls `apiClient.bulkDeleteImages`.
3. Success: `emit(rest, coverAfterDeleteMany(coverId, ids, rest))`, toast
   (`Image deleted` / `{n} images deleted`), exit select mode.
4. Failure: error toast, selection preserved, still in select mode, nothing removed from the grid.

Row `position` values are left gapped after deletion, exactly as single delete does today — only
relative order matters for display.

## 4. Public page lightbox

### `components/public/trip-gallery.tsx`

Becomes a client component owning `openIndex: number | null`. Client components are still
server-rendered, so the `<img>` tags remain in the initial HTML and SEO/LCP are unaffected.

Each tile becomes `<button type="button" aria-label="Open photo {n}">` with `cursor-zoom-in`, a
visible focus ring, and a small `hover:scale-[1.02]` affordance. The empty state is unchanged.

### `components/public/trip-lightbox.tsx`

New component: `Dialog` plus the already-installed embla `Carousel`
(`components/ui/carousel.tsx`), opened at `startIndex: openIndex`, `loop: false`.

- `showCloseButton={false}` on `DialogContent`; a custom `DialogClose` sits at `top-3 right-3`
  with `variant="secondary"` and `size="icon"`, plus an `sr-only` "Close" label. The default ghost
  X has too little contrast over a photograph.
- **The close button is rendered inside the `<Carousel>` element.** `Carousel` binds its arrow-key
  handler with `onKeyDownCapture` on its own root div (`components/ui/carousel.tsx:122`), so key
  events only reach it from descendants. `Dialog` auto-focuses the first focusable element, which
  is the close button — placing it outside the carousel would silently break ←/→.
- The photo is `object-contain` inside an `80svh` frame, `sizes="(max-width: 640px) 100vw, 90vw"`.
- Arrows are `hidden sm:flex`. On a phone, swipe is the expected gesture and on-screen arrows only
  cover the image.
- A `{current} / {total}` pill sits below the photo on a `bg-foreground/60` background. `Carousel`
  exposes no selected index, so the lightbox passes `setApi` and subscribes to embla's `select` and
  `reInit` events to drive the counter, unsubscribing on unmount.
- Close via X, Escape, or backdrop click. ←/→ move between photos on desktop (already implemented
  by `Carousel`; no extra key handling needed).

### `components/ui/dialog.tsx`

`DialogContent` hardcodes `<DialogOverlay />` with `bg-black/10 backdrop-blur-xs` and offers no way
to override it — too light for a photo lightbox. It gains an optional `overlayClassName?: string`
that is forwarded to `DialogOverlay`. Backward-compatible: no existing dialog changes appearance.

## Design system

All styling uses semantic token classes (`ring-primary`, `bg-popover`, `text-muted-foreground`,
`bg-foreground/60`, `rounded-lg`) resolved from `app/tokens.generated.css`. No literal colours or
spacing values. `design/tokens.json` is untouched, so `pnpm tokens` does not need to run.

## Files

**Modified**

- `components/trips/image-manager.tsx` — optimistic cover, select mode, bulk delete wiring
- `components/public/trip-gallery.tsx` — client component, clickable tiles, lightbox host
- `components/ui/dialog.tsx` — optional `overlayClassName` passthrough
- `lib/trips/cover.ts` — add `coverAfterDeleteMany`, delegate `coverAfterDelete`
- `lib/services/images.service.ts` — add `deleteImages`
- `lib/validation/trip.ts` — add `bulkDeleteImagesSchema`
- `lib/api-client/index.ts` — add `bulkDeleteImages`

**New**

- `components/trips/delete-images-dialog.tsx`
- `components/public/trip-lightbox.tsx`
- `app/api/trips/[id]/images/bulk-delete/route.ts`

No migration is required: the batch endpoint reads and writes the same `trip_images` and `trips`
columns as the existing single-image delete, under the same RLS policies.

## Verification

No new tests, per the requester. Verification is `pnpm test` (existing suite must stay green),
`pnpm lint`, and `pnpm build`, plus a manual pass over the trip editor and a public trip page at
both mobile and desktop widths.
