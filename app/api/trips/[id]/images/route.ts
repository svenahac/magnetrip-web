import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { registerImageSchema } from '@/lib/validation/trip';
import { registerImage } from '@/lib/services/images.service';

export const POST = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, registerImageSchema);
  return NextResponse.json(await registerImage(supabase, id, input), { status: 201 });
});
