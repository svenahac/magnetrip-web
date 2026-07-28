import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingPublicTrip() {
  return (
    <main className="w-full">
      <Skeleton className="h-[45svh] max-h-[460px] min-h-[240px] w-full rounded-none" />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
