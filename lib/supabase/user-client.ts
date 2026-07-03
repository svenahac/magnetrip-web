import { createClient } from '@supabase/supabase-js';
import { getPublicEnv } from '@/lib/env';

/** Client scoped to a caller's JWT (used for Flutter's Bearer-token requests).
 *  RLS enforces ownership because every query runs as this user. */
export function createUserSupabaseClient(accessToken: string) {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
