import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createUserSupabaseClient } from '@/lib/supabase/user-client';
import { ServiceError } from '@/lib/services/errors';
import { extractBearerToken } from './errors';

export async function resolveApiContext(
  request: Request,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const token = extractBearerToken(request.headers.get('authorization'));
  const supabase = token ? createUserSupabaseClient(token) : await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ServiceError('unauthorized', 'Authentication required');
  return { supabase, userId: data.user.id };
}
