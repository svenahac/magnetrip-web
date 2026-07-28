import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripImage, RegisterImageInput } from '@/lib/types/trip';
import { coverAfterAdd, coverAfterDelete } from '@/lib/trips/cover';
import { ServiceError } from './errors';
import { mapImageRow, type ImageRow } from './mappers';
import { IMAGE_COLUMNS } from './trips.service';

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/**
 * Reads the trip's current cover. Returns undefined when it cannot be read —
 * the caller then skips auto-assignment rather than guessing.
 */
async function readCover(
  supabase: SupabaseClient,
  tripId: string,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from('trips').select('cover_image_id').eq('id', tripId).maybeSingle();
  if (error || !data) return undefined;
  return (data as { cover_image_id: string | null }).cover_image_id;
}

/**
 * Moves the cover to [next] unless it is already there. Auto-assignment is a
 * convenience on top of a request that has already succeeded, so a failure here
 * is logged rather than thrown.
 */
async function writeCover(
  supabase: SupabaseClient,
  tripId: string,
  previous: string | null,
  next: string | null,
): Promise<void> {
  if (next === previous) return;
  const { error } = await supabase
    .from('trips').update({ cover_image_id: next }).eq('id', tripId);
  if (error) console.error('Failed to auto-assign the trip cover image:', error.message);
}

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

  const image = mapImageRow(data as ImageRow);
  // The first image of a coverless trip becomes its cover, so every trip with
  // photos has one without the user having to pick.
  const cover = await readCover(supabase, tripId);
  if (cover !== undefined) {
    await writeCover(supabase, tripId, cover, coverAfterAdd(cover, image.id));
  }
  return image;
}

/** Throws ServiceError('validation') unless incomingIds is an exact, duplicate-free permutation of ownedIds. */
export function assertValidReorder(incomingIds: string[], ownedIds: string[]): void {
  const incoming = new Set(incomingIds);
  const owned = new Set(ownedIds);
  const bijection =
    incoming.size === incomingIds.length && // no duplicates
    incoming.size === owned.size &&
    incomingIds.every((id) => owned.has(id));
  if (!bijection) throw new ServiceError('validation', 'Image list does not match this trip');
}

export async function reorderImages(
  supabase: SupabaseClient,
  tripId: string,
  imageIds: string[],
): Promise<void> {
  const { data: existing, error } = await supabase
    .from('trip_images').select('id').eq('trip_id', tripId);
  if (error) throw new ServiceError('internal', error.message);
  assertValidReorder(imageIds, (existing ?? []).map((r: { id: string }) => r.id));
  for (let i = 0; i < imageIds.length; i++) {
    const { error: upErr } = await supabase
      .from('trip_images').update({ position: i }).eq('id', imageIds[i]).eq('trip_id', tripId);
    if (upErr) throw new ServiceError('internal', upErr.message);
  }
}

export async function deleteImage(supabase: SupabaseClient, imageId: string): Promise<void> {
  const { data: img, error } = await supabase
    .from('trip_images').select('id, trip_id, storage_path').eq('id', imageId).maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!img) throw new ServiceError('not_found', 'Image not found');

  const tripId = (img as { trip_id: string }).trip_id;
  // Read the cover before the delete: the FK nulls the column on the way out,
  // so afterwards there is no way to tell whether this image was the cover.
  const cover = await readCover(supabase, tripId);

  const { error: delErr } = await supabase.from('trip_images').delete().eq('id', imageId);
  if (delErr) throw new ServiceError('internal', delErr.message);

  if (cover === imageId) {
    const { data: rows, error: restErr } = await supabase
      .from('trip_images').select('id, position').eq('trip_id', tripId);
    if (restErr) {
      console.error('Failed to promote a new trip cover image:', restErr.message);
    } else {
      const remaining = (rows ?? []) as { id: string; position: number }[];
      // null needs no write — the FK already cleared it.
      await writeCover(supabase, tripId, null, coverAfterDelete(cover, imageId, remaining));
    }
  }

  const { error: removeErr } = await supabase.storage
    .from('trip-images')
    .remove([(img as { storage_path: string }).storage_path]);
  if (removeErr) {
    console.error('Failed to remove trip image from storage:', removeErr.message);
  }
}
