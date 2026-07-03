import { headers } from 'next/headers';
import type { PublicTrip } from '@/lib/types/trip';

/** Absolute base URL for the CURRENT deployment, from the incoming request. */
async function requestBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

/** Fetch a public trip via the API layer. Returns null when the trip does not exist (404). */
export async function fetchPublicTrip(publicId: string): Promise<PublicTrip | null> {
  const base = await requestBaseUrl();
  const res = await fetch(`${base}/api/public/trips/${encodeURIComponent(publicId)}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load trip (${res.status})`);
  return (await res.json()) as PublicTrip;
}
