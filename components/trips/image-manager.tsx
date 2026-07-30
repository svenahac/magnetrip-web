'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Star, Trash2 } from 'lucide-react';
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

  function emit(nextImages: TripImage[], nextCover: string | null) {
    setImages(nextImages);
    setCoverId(nextCover);
    onChange({ images: nextImages, coverImageId: nextCover });
  }

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

  async function persistOrder(next: TripImage[]) {
    const previous = images;
    emit(next, coverId);
    try {
      await apiClient.reorderImages(trip.id, next.map((i) => i.id));
    } catch (err) {
      emit(previous, coverId); // revert on failure
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
          {images.map((img, index) => (
            <div
              key={img.id}
              draggable={!uploading}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className="group relative cursor-move overflow-hidden rounded-lg border border-border"
            >
              <AspectRatio ratio={1}>
                <Image src={img.url} alt={`Trip photo ${index + 1}`} fill sizes="33vw" className="object-cover" />
              </AspectRatio>
              {coverId === img.id ? (
                <Badge className="absolute left-2 top-2">Cover</Badge>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-foreground/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button type="button" size="icon" variant="secondary" aria-label="Set as cover"
                  disabled={uploading} onClick={() => void setCover(img.id)}><Star className="size-4" /></Button>
                <Button type="button" size="icon" variant="destructive" aria-label="Delete image"
                  disabled={uploading} onClick={() => askDelete([img.id])}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteImagesDialog
        count={deleteCount}
        coverAffected={coverId !== null && (pendingDelete?.includes(coverId) ?? false)}
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        loading={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
