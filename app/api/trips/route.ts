import { NextResponse } from 'next/server';
import { route, parseBody } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { createTripSchema } from '@/lib/validation/trip';
import { listTrips, createTrip } from '@/lib/services/trips.service';

export const GET = route(async (request) => {
  const { supabase } = await resolveApiContext(request);
  return NextResponse.json(await listTrips(supabase));
});

export const POST = route(async (request) => {
  const { supabase, userId } = await resolveApiContext(request);
  const input = await parseBody(request, createTripSchema);
  return NextResponse.json(await createTrip(supabase, userId, input), { status: 201 });
});
