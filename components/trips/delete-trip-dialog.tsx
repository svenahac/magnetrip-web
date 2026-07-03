'use client';

import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DeleteTripDialog({
  tripId, open, onOpenChange, onDeleted,
}: {
  tripId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!tripId) return;
    setLoading(true);
    try {
      await apiClient.deleteTrip(tripId);
      onDeleted(tripId);
      toast.success('Trip deleted');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the trip');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the trip and its images. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => { e.preventDefault(); void confirm(); }}
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
