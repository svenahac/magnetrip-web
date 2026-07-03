import { NextResponse } from 'next/server';
import { route, type RouteCtx } from '@/lib/api/route';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getPublicTrip } from '@/lib/services/public.service';

export const GET = route(async (_request, { params }: RouteCtx) => {
  const { publicId } = await params;
  const supabase = await createServerSupabaseClient();
  return NextResponse.json(await getPublicTrip(supabase, publicId));
});
