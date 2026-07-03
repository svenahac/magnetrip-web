'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Trip } from '@/lib/types/trip';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function TripDetailsForm({ trip, onSaved }: { trip: Trip; onSaved: (t: Trip) => void }) {
  const [name, setName] = useState(trip.name);
  const [year, setYear] = useState(trip.year?.toString() ?? '');
  const [description, setDescription] = useState(trip.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length === 0) { setError('Trip name is required'); return; }
    const parsedYear = year.trim() === '' ? null : Number(year);
    if (parsedYear !== null && !Number.isInteger(parsedYear)) { setError('Year must be a whole number'); return; }
    setLoading(true);
    try {
      const updated = await apiClient.updateTrip(trip.id, {
        name: name.trim(),
        year: parsedYear,
        description: description.trim() === '' ? null : description.trim(),
      });
      onSaved(updated);
      toast.success('Saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Trip name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="year">Year</Label>
        <Input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2024" disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" rows={5} value={description}
          onChange={(e) => setDescription(e.target.value)} disabled={loading} />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : 'Save changes'}
      </Button>
    </form>
  );
}
