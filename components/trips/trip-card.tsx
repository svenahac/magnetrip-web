'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Pencil, ExternalLink, Link as LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TripListItem } from '@/lib/types/trip';
import { descriptionPreview, publicTripUrl } from '@/lib/trips/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TripCard({ trip, onDelete }: { trip: TripListItem; onDelete: (id: string) => void }) {
  const url = publicTripUrl(trip.publicId);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  }

  return (
    <Card className="overflow-hidden">
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {trip.coverUrl ? (
          <Image src={trip.coverUrl} alt={trip.name} fill sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-primary/80 via-primary/40 to-brand-accent/60" />
        )}
      </AspectRatio>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold">{trip.name}</h3>
            {trip.year ? <Badge variant="secondary" className="mt-1">{trip.year}</Badge> : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Trip actions" />}>
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/trips/${trip.id}/edit`} />}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="size-4" /> Show public page
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { void copyLink(); }}>
                <LinkIcon className="size-4" /> Copy public link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(trip.id)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {descriptionPreview(trip.description) ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{descriptionPreview(trip.description)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
