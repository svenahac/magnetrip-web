import { NextResponse } from 'next/server';
import { route, parseBody, type RouteCtx } from '@/lib/api/route';
import { resolveApiContext } from '@/lib/api/auth';
import { linkNfcSchema } from '@/lib/validation/trip';
import { linkNfc } from '@/lib/services/nfc.service';

export const PATCH = route(async (request, { params }: RouteCtx) => {
  const { id } = await params;
  const { supabase } = await resolveApiContext(request);
  const input = await parseBody(request, linkNfcSchema);
  return NextResponse.json(await linkNfc(supabase, id, input));
});
