'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, ImagePlus, SquareCheckBig, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';
import { coverAfterAdd, coverAfterDeleteMany } from '@/lib/trips/cover';
import { uploadTripImage } from '@/lib/trips/upload';
import type { Trip, TripImage } from '@/lib/types/trip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Spinner } from '@/components/ui/spinner';
import { DeleteImagesDialog } from '@/components/trips/delete-images-dialog';
import { cn } from '@/lib/utils';

export function ImageManager({
  trip,
  onChange,
}: {
  trip: Trip;
  onChange: (patch: { images: TripImage[]; coverImageId: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<TripImage[]>(trip.images);
  const [coverId, setCoverId] = useState<string | null>(trip.coverImageId);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // The ids awaiting confirmation; null means the dialog is closed.
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Held in state rather than derived from pendingDelete so the copy does not
  // flicker to the single-image wording during the dialog's close animation.
  const [deleteCount, setDeleteCount] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  // Held in state for the same reason as deleteCount: derived-from-pendingDelete
  // would flicker false while the dialog is still animating out (pendingDelete
  // is nulled in confirmDelete's finally before the close animation finishes).
  const [coverAffected, setCoverAffected] = useState(false);

  // Mirrors the latest emitted state so async revert/reconcile paths (in
  // setCover and persistOrder) can read the current truth instead of a stale
  // closure snapshot — a delete, or another cover change, can land while one
  // of those requests is still in flight. Only ever read inside async
  // callbacks below, never during render.
  const latestImagesRef = useRef<TripImage[]>(images);
  const latestCoverRef = useRef<string | null>(coverId);
  // Bumped at the start of every setCover call so a superseded in-flight
  // request's reconcile/revert can't overwrite a newer one.
  const coverSeqRef = useRef(0);

  function emit(nextImages: TripImage[], nextCover: string | null) {
    latestImagesRef.current = nextImages;
    latestCoverRef.current = nextCover;
    setImages(nextImages);
    setCoverId(nextCover);
    onChange({ images: nextImages, coverImageId: nextCover });
  }

  // Cover-only update: applies against the latest known image list rather
  // than a closure snapshot, and no-ops when the target cover id is no
  // longer present in that list — so a cover write can never resurrect
  // already-deleted images or point the cover at a gone id.
  function applyCover(nextCover: string | null) {
    const current = latestImagesRef.current;
    if (nextCover !== null && !current.some((img) => img.id === nextCover)) return;
    emit(current, nextCover);
  }

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

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    const next = [...images];
    // Tracked locally for the same reason as `next`: setState is async, so
    // reading `coverId` back inside the loop would see the render-time value.
    // registerImage auto-assigns the cover server-side; mirror it here so the
    // badge appears without a refetch.
    let cover = coverId;
    for (const file of files) {
      try {
        const img = await uploadTripImage(trip.id, file, next.length);
        next.push(img);
        cover = coverAfterAdd(cover, img.id);
        emit([...next], cover);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
  }

  function askDelete(ids: string[]) {
    if (ids.length === 0) return;
    setDeleteCount(ids.length);
    setCoverAffected(coverId !== null && ids.includes(coverId));
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
      exitSelectMode();
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

  // Optimistic, mirroring persistOrder below: the badge has to move on the click,
  // so the PATCH result only ever reconciles or reverts. All three writes go
  // through applyCover (not emit(images, ...)) so a stale closure over `images`
  // can never resurrect images a concurrent delete already removed, and the
  // seq guard means a request that a later click has superseded can't stomp
  // that later click's result once it resolves.
  async function setCover(imageId: string) {
    const previous = coverId;
    if (previous === imageId) return;
    const seq = ++coverSeqRef.current;
    applyCover(imageId);
    try {
      const updated = await apiClient.updateTrip(trip.id, { coverImageId: imageId });
      if (coverSeqRef.current !== seq) return;
      if (updated.coverImageId !== imageId) applyCover(updated.coverImageId);
      toast.success('Cover updated');
    } catch (err) {
      if (coverSeqRef.current !== seq) return;
      applyCover(previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not set the cover');
    }
  }

  async function persistOrder(next: TripImage[]) {
    const previous = images;
    const previousCover = coverId;
    // Renumber positions to match what reorderImages writes server-side
    // (`position = i`, lib/services/images.service.ts:110-116). Without this
    // the client keeps stale pre-drag positions for the rest of the editing
    // session, so a later cover promotion (coverAfterDeleteMany, which picks
    // the lowest-position survivor) can pick a different image than the
    // server did.
    const renumbered = next.map((img, i) => ({ ...img, position: i }));
    emit(renumbered, coverId);
    try {
      await apiClient.reorderImages(trip.id, renumbered.map((i) => i.id));
    } catch (err) {
      // Don't resurrect: a delete may have landed while this reorder was in
      // flight, so only restore the ordering for images that still exist,
      // appending any images that appeared since (from an upload) in their
      // current order. Only reinstate the pre-reorder cover if it's still
      // around; otherwise defer to whatever cover is currently live rather
      // than reintroducing a deleted id.
      const current = latestImagesRef.current;
      const currentIds = new Set(current.map((img) => img.id));
      const restoredOrder = previous.filter((img) => currentIds.has(img.id));
      const restoredOrderIds = new Set(restoredOrder.map((img) => img.id));
      const appended = current.filter((img) => !restoredOrderIds.has(img.id));
      const restoredCover =
        previousCover !== null && currentIds.has(previousCover) ? previousCover : latestCoverRef.current;
      emit([...restoredOrder, ...appended], restoredCover);
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

  return (
    <section className="space-y-3">
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

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No images yet. Add photos to build your trip gallery.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        </div>
      )}

      <DeleteImagesDialog
        count={deleteCount}
        coverAffected={coverAffected}
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
