'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Confirmation for removing one or many trip images. Presentational only — the
 * caller owns the images state and decides which endpoint to hit.
 */
export function DeleteImagesDialog({
  count, coverAffected, open, onOpenChange, loading, onConfirm,
}: {
  count: number;
  coverAffected: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: () => void;
}) {
  const single = count === 1;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {single ? 'Delete this image?' : `Delete ${count} images?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {single
              ? 'This permanently removes the photo from your trip. This cannot be undone.'
              : `This permanently removes ${count} photos from your trip. This cannot be undone.`}
            {coverAffected ? ' The trip cover will move to the next photo.' : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={loading}
          >
            {loading ? 'Deleting…' : single ? 'Delete' : `Delete ${count}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
