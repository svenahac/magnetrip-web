import Image from 'next/image';

/**
 * The branded 45% panel shared by every auth screen. Purely presentational —
 * it knows nothing about forms, routing or auth state.
 *
 * The gradient's middle stop sits at 45% for contrast, not aesthetics: white on
 * --primary is 3.74:1 (fails AA), while white on --primary-dark is 6.15:1.
 * Centring the content over the darker band is what makes the copy legible.
 */
export function AuthBrandPanel() {
  return (
    <div className="flex h-[45svh] shrink-0 flex-col items-center justify-center gap-3 bg-[linear-gradient(160deg,var(--primary)_0%,var(--primary-dark)_45%,var(--primary-deep)_100%)] px-6 text-center md:h-auto md:w-[45%]">
      <Image
        src="/brand/logo.png"
        alt=""
        width={384}
        height={384}
        sizes="128px"
        priority
        className="size-24 rounded-full border-[3px] border-white/95 object-cover shadow-[0_7px_20px_rgba(0,0,0,0.32)] md:size-32"
      />
      <p className="text-xl font-extrabold tracking-tight text-white md:text-2xl">Magnetrip</p>
      <p className="text-[13px] text-white/90">Your trips, on a magnet.</p>
    </div>
  );
}
