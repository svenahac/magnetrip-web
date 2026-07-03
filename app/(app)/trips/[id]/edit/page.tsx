'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Trip } from '@/lib/types/trip';
import { TripDetailsForm } from '@/components/trips/trip-details-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function TripEditorPage() {
  const id = useParams<{ id: string }>().id;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setTrip(null);
    try {
      setTrip(await apiClient.getTrip(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this trip');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to trips
      </Link>

      {error ? (
        <div role="alert" className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Try again</Button>
        </div>
      ) : trip === null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{trip.name}</h1>
          <TripDetailsForm trip={trip} onSaved={setTrip} />
          {/* Image manager is mounted here in Task 6 */}
        </>
      )}
    </div>
  );
}
