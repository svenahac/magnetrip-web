import { NextResponse } from 'next/server';
import { route, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { deleteImage } from '@/lib/services/images.service';

export const DELETE = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  await deleteImage(supabase, id);
  return new NextResponse(null, { status: 204 });
});
