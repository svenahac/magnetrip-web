import Image from 'next/image';

/** Full-bleed hero for the public trip page: cover image with the trip name + year overlaid. */
export function TripHero({
  coverUrl,
  name,
  year,
}: {
  coverUrl: string | null;
  name: string;
  year: number | null;
}) {
  return (
    <section className="relative h-[45svh] max-h-[460px] min-h-[240px] w-full overflow-hidden bg-muted">
      {coverUrl ? (
        <Image src={coverUrl} alt={name} fill sizes="100vw" priority className="object-cover" />
      ) : (
        <div className="size-full bg-gradient-to-br from-primary via-primary/70 to-brand-accent" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-4xl px-4 pb-6 sm:pb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-background drop-shadow-sm sm:text-5xl">
          {name}
        </h1>
        {year ? (
          <p className="mt-1 text-sm font-medium text-background/80 sm:mt-2 sm:text-base">{year}</p>
        ) : null}
      </div>
    </section>
  );
}
