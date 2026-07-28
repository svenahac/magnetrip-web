'use client';

import { ExternalLink, Link as LinkIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { publicTripUrl } from '@/lib/trips/format';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Copy a trip's public link to the clipboard, reporting the outcome as a toast. */
export async function copyPublicLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Public link copied');
  } catch {
    toast.error('Could not copy the link');
  }
}

/** Compact on mobile (icon only, 32px tap target), labelled and denser from `sm` up. */
const actionSize = 'h-8 px-2.5 sm:h-6 sm:px-2';
/** Explicit sizes opt out of the variant's fixed 12px icon, which looks lost at mobile height. */
const actionIcon = 'size-4 sm:size-3';

/** Open / copy / delete shortcuts for a single trip. */
export function TripActions({ publicId, onDelete }: { publicId: string; onDelete: () => void }) {
  const url = publicTripUrl(publicId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* A real anchor, styled as a button: Base UI's Button would need nativeButton={false},
          which stamps role="button" over the native link semantics. */}
      <a href={url} target="_blank" rel="noopener noreferrer" data-slot="button"
        aria-label="Show public page" title="Show public page"
        className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), actionSize)}>
        <ExternalLink className={actionIcon} />
        <span className="hidden sm:inline">Show public page</span>
      </a>
      <Button variant="outline" size="xs" className={actionSize}
        aria-label="Copy public link" title="Copy public link"
        onClick={() => { void copyPublicLink(url); }}>
        <LinkIcon className={actionIcon} />
        <span className="hidden sm:inline">Copy public link</span>
      </Button>
      <Button variant="destructive" size="xs" className={actionSize}
        aria-label="Delete trip" title="Delete trip" onClick={onDelete}>
        <Trash2 className={actionIcon} />
        <span className="hidden sm:inline">Delete</span>
      </Button>
    </div>
  );
}
