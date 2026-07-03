import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient() {
  if (client) return client;
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
