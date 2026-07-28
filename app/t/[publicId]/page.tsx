import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicTrip } from '@/lib/trips/public-fetch';
import { TripGallery } from '@/components/public/trip-gallery';
import { TripHero } from '@/components/public/trip-hero';

type Params = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) return { title: 'Trip not found · Magnetrip' };
  const description = trip.description ?? 'A travel trip on Magnetrip';
  const ogImage = trip.coverUrl ?? trip.images[0]?.url;
  return {
    title: `${trip.name} · Magnetrip`,
    description,
    openGraph: {
      title: trip.name,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
    },
  };
}

export default async function PublicTripPage({ params }: Params) {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) notFound();

  return (
    <main className="w-full">
      <TripHero coverUrl={trip.coverUrl} name={trip.name} year={trip.year} />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        {trip.description ? (
          <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-foreground/90">
            {trip.description}
          </p>
        ) : null}
        <div className={trip.description ? 'mt-8' : undefined}>
          <TripGallery images={trip.images} alt={trip.name} />
        </div>
      </div>
    </main>
  );
}
