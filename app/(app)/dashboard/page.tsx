'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { TripListItem } from '@/lib/types/trip';
import { TripCard } from '@/components/trips/trip-card';
import { NewTripDialog } from '@/components/trips/new-trip-dialog';
import { DeleteTripDialog } from '@/components/trips/delete-trip-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export default function DashboardPage() {
  const [trips, setTrips] = useState<TripListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setTrips(null);
    try {
      setTrips(await apiClient.listTrips());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your trips');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your trips</h1>
        <NewTripDialog />
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void load()}>Try again</Button>
        </div>
      ) : trips === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPinned /></EmptyMedia>
            <EmptyTitle>No trips yet</EmptyTitle>
            <EmptyDescription>Create your first Magnet to start collecting memories.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><NewTripDialog /></EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} onDelete={setDeleteId} />
          ))}
        </div>
      )}

      <DeleteTripDialog
        tripId={deleteId}
        open={deleteId !== null}
        onOpenChange={(o) => { if (!o) setDeleteId(null); }}
        onDeleted={(id) => setTrips((cur) => (cur ?? []).filter((t) => t.id !== id))}
      />
    </div>
  );
}
