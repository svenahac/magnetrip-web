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
