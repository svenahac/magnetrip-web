import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function TripNotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold">Trip not found</h1>
      <p className="text-sm text-muted-foreground">This trip doesn&apos;t exist or is no longer available.</p>
      <Link href="/" className="text-sm text-primary hover:underline">Go to Magnetrip</Link>
    </main>
  );
}
