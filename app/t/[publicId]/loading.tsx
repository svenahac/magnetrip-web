import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingPublicTrip() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <div className="space-y-3">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    </main>
  );
}
