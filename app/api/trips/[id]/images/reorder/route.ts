import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { reorderImagesSchema } from '@/lib/validation/trip';
import { reorderImages } from '@/lib/services/images.service';

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const { imageIds } = await parseBody(request, reorderImagesSchema);
  await reorderImages(supabase, id, imageIds);
  return new NextResponse(null, { status: 204 });
});
