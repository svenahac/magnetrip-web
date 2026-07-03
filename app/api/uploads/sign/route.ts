import { NextResponse } from 'next/server';
import { z } from 'zod';
import { route, parseBody } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { createSignedUpload } from '@/lib/services/images.service';

const signSchema = z.object({
  tripId: z.string().uuid(),
  ext: z.string().min(1).max(10),
});

export const POST = route(async (request) => {
  const { supabase, userId } = await resolveApiContext(request);
  const { tripId, ext } = await parseBody(request, signSchema);
  return NextResponse.json(await createSignedUpload(supabase, userId, tripId, ext));
});
