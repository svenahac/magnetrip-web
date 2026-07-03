'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function NewTripDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) { setError('Please enter a trip name'); return; }
    setLoading(true);
    try {
      const trip = await apiClient.createTrip({ name: name.trim() });
      router.push(`/trips/${trip.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the trip');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setName(''); setError(null); } }}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" /> New trip
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a trip</DialogTitle></DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip name</Label>
            <Input id="trip-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amalfi Coast" disabled={loading} autoFocus />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
