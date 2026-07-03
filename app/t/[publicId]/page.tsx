import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicTrip } from '@/lib/trips/public-fetch';
import { TripGallery } from '@/components/public/trip-gallery';

type Params = { params: Promise<{ publicId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) return { title: 'Trip not found · Magnetrip' };
  const description = trip.description ?? 'A travel trip on Magnetrip';
  return {
    title: `${trip.name} · Magnetrip`,
    description,
    openGraph: {
      title: trip.name,
      description,
      images: trip.images[0] ? [{ url: trip.images[0].url }] : [],
    },
  };
}

export default async function PublicTripPage({ params }: Params) {
  const { publicId } = await params;
  const trip = await fetchPublicTrip(publicId);
  if (!trip) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{trip.name}</h1>
        {trip.year ? <p className="text-sm font-medium text-muted-foreground">{trip.year}</p> : null}
        {trip.description ? (
          <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-foreground/90">
            {trip.description}
          </p>
        ) : null}
      </header>
      <div className="mt-8">
        <TripGallery images={trip.images} alt={trip.name} />
      </div>
    </main>
  );
}
