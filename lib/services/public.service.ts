import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublicTrip } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { getPublicEnv } from '@/lib/env';

// The get_public_trip RPC returns image urls as the object path "trip-images/<storage_path>".
// Convert to an absolute public URL for consumers.
function toAbsolute(objectPath: string): string {
  const { supabaseUrl } = getPublicEnv();
  return `${supabaseUrl}/storage/v1/object/public/${objectPath}`;
}

interface RpcTrip {
  name: string;
  year: number | null;
  description: string | null;
  cover: string | null;
  images: { url: string; position: number }[];
}

export async function getPublicTrip(supabase: SupabaseClient, publicId: string): Promise<PublicTrip> {
  const { data, error } = await supabase.rpc('get_public_trip', { p_public_id: publicId });
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');
  const trip = data as RpcTrip;
  return {
    name: trip.name,
    year: trip.year,
    description: trip.description,
    coverUrl: trip.cover ? toAbsolute(trip.cover) : null,
    images: (trip.images ?? []).map((img) => ({ url: toAbsolute(img.url), position: img.position })),
  };
}
