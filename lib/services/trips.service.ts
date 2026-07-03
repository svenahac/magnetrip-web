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
