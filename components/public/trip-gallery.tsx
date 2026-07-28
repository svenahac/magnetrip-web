import Image from 'next/image';

export function TripGallery({
  images,
  alt,
}: {
  images: { url: string; position: number }[];
  alt: string;
}) {
  if (images.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No photos yet.
      </div>
    );
  }
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {sorted.map((img, i) => (
        <div key={`${img.url}-${i}`} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          <Image
            src={img.url}
            alt={`${alt} — photo ${i + 1}`}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            loading="lazy"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
