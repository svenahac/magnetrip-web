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
