'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TripLightbox } from '@/components/public/trip-lightbox';

export function TripGallery({
  images,
  alt,
}: {
  images: { url: string; position: number }[];
  alt: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No photos yet.
      </div>
    );
  }
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sorted.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            aria-label={`Open photo ${i + 1} of ${sorted.length}`}
            onClick={() => setOpenIndex(i)}
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg bg-muted outline-none transition-transform hover:scale-[1.02] focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Image
              src={img.url}
              alt={`${alt} — photo ${i + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              loading="lazy"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {/* Keyed on openIndex so every open remounts with a matching startIndex. */}
      {openIndex !== null ? (
        <TripLightbox
          key={openIndex}
          images={sorted}
          alt={alt}
          openIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}
