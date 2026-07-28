'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Pencil, ExternalLink, Link as LinkIcon, Trash2 } from 'lucide-react';
import type { TripListItem } from '@/lib/types/trip';
import { descriptionPreview, publicTripUrl } from '@/lib/trips/format';
import { copyPublicLink } from '@/components/trips/trip-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function TripCard({ trip, onDelete }: { trip: TripListItem; onDelete: (id: string) => void }) {
  const url = publicTripUrl(trip.publicId);

  return (
    <Card className="group gap-0 overflow-hidden py-0">
      <AspectRatio ratio={16 / 9} className="overflow-hidden bg-muted">
        {trip.coverUrl ? (
          <Image src={trip.coverUrl} alt={trip.name} fill sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="size-full bg-gradient-to-br from-primary/80 via-primary/40 to-brand-accent/60" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-foreground/20 to-transparent" />
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
            <DropdownMenuContent align="end" className="w-auto min-w-48 max-w-[calc(100vw-2rem)]">
              <DropdownMenuItem className="whitespace-nowrap" render={<Link href={`/trips/${trip.id}/edit`} />}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="whitespace-nowrap" render={<a href={url} target="_blank" rel="noopener noreferrer" />}>
                <ExternalLink className="size-4" /> Show public page
              </DropdownMenuItem>
              <DropdownMenuItem className="whitespace-nowrap" onClick={() => { void copyPublicLink(url); }}>
                <LinkIcon className="size-4" /> Copy public link
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="whitespace-nowrap" variant="destructive" onClick={() => onDelete(trip.id)}>
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
