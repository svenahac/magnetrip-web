'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Enlarged photo viewer. Mounted only while open and keyed on the opening index,
 * so `startIndex` and the counter are always in step.
 */
export function TripLightbox({
  images, alt, openIndex, onClose,
}: {
  images: { url: string }[];
  alt: string;
  openIndex: number;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(openIndex);

  // Subscribe only. The initial value already comes from `startIndex`, so there is
  // no need to setState in the effect body (which react-hooks lint forbids).
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-foreground/90 supports-backdrop-filter:backdrop-blur-sm"
        className="w-[min(96vw,1200px)] max-w-none gap-3 border-0 bg-transparent p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt} — photo viewer</DialogTitle>
        <Carousel opts={{ startIndex: openIndex, loop: false }} setApi={setApi} className="w-full">
          {/* Inside <Carousel> on purpose: Dialog autofocuses this button, and the
              carousel only sees arrow keys from its own descendants. */}
          <DialogClose
            render={<Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 rounded-full" />}
          >
            <X />
            <span className="sr-only">Close</span>
          </DialogClose>
          <CarouselContent>
            {images.map((img, i) => (
              <CarouselItem key={`${img.url}-${i}`}>
                <div className="relative h-[80svh] w-full">
                  <Image
                    src={img.url}
                    alt={`${alt} — photo ${i + 1}`}
                    fill
                    sizes="(max-width: 640px) 100vw, 90vw"
                    priority={i === openIndex}
                    className="object-contain"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* Hidden below sm: swipe is the right gesture on a phone, and arrows
              would just sit on top of the photo. left-3/right-3 override the
              primitive's -left-12/-right-12, which is off-screen at this width. */}
          <CarouselPrevious variant="secondary" className="left-3 hidden sm:flex" />
          <CarouselNext variant="secondary" className="right-3 hidden sm:flex" />
        </Carousel>
        {images.length > 1 ? (
          <p className="mx-auto rounded-full bg-foreground/60 px-3 py-1 text-xs font-medium text-background">
            {current + 1} / {images.length}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
