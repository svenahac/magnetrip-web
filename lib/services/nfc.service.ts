import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip, LinkNfcInput } from '@/lib/types/trip';
import { ServiceError } from './errors';
import { getTrip } from './trips.service';

export async function linkNfc(
  supabase: SupabaseClient,
  tripId: string,
  input: LinkNfcInput,
): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({ nfc_tag_id: input.nfcTagId, nfc_linked_at: new Date().toISOString() })
    .eq('id', tripId)
    .select('id')
    .maybeSingle();
  if (error) throw new ServiceError('internal', error.message);
  if (!data) throw new ServiceError('not_found', 'Trip not found');
  return getTrip(supabase, tripId);
}
