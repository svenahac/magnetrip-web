import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { updateTripSchema } from '@/lib/validation/trip';
import { getTrip, updateTrip, deleteTrip } from '@/lib/services/trips.service';

export const GET = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  return NextResponse.json(await getTrip(supabase, id));
});

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, updateTripSchema);
  return NextResponse.json(await updateTrip(supabase, id, input));
});

export const DELETE = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  await deleteTrip(supabase, id);
  return new NextResponse(null, { status: 204 });
});
