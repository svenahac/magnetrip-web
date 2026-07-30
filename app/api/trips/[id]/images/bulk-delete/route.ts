import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { bulkDeleteImagesSchema } from '@/lib/validation/trip';
import { deleteImages } from '@/lib/services/images.service';

export const POST = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const { imageIds } = await parseBody(request, bulkDeleteImagesSchema);
  const deleted = await deleteImages(supabase, id, imageIds);
  return NextResponse.json({ deleted });
});
