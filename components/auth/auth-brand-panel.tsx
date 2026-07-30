import Image from 'next/image';

/**
 * The branded 45% panel shared by every auth screen. Purely presentational —
 * it knows nothing about forms, routing or auth state.
 *
 * The gradient's middle stop sits at 45% for contrast, not aesthetics: white on
 * --primary is 3.74:1 (fails AA), while white on --primary-dark measures 6.55:1
 * (wordmark, needs 3.0 as large text) and 5.80:1 (90%-opacity tagline, needs 4.5).
 * Centring the content over the darker band is what makes the copy legible.
 * Measured in Chrome; both clear their WCAG AA thresholds.
 *
 * `min-h-60` (240px) floors the panel below `md`, where height is a `45svh`
 * percentage: the content (medallion + gaps + wordmark + tagline) is a
 * deterministic ~168px tall, so on short landscape phones a literal 45% can be
 * shorter than the content and spill over the panel edge. The floor keeps the
 * content from overflowing on those short screens. Mirrors the same 240px/240dp
 * floor in Flutter's `auth_scaffold.dart`.
 */
export function AuthBrandPanel() {
  return (
    <div className="flex h-[45svh] min-h-60 shrink-0 flex-col items-center justify-center gap-3 bg-[linear-gradient(160deg,var(--primary)_0%,var(--primary-dark)_45%,var(--primary-deep)_100%)] px-6 text-center md:h-auto md:w-[45%]">
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
      <p className="text-[13px] text-white/90">Tap a magnet. Relive the trip.</p>
    </div>
  );
}
