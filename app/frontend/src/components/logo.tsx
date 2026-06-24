import type { ReactNode } from "react";

/**
 * Arclight brand mark and wordmark.
 *
 * The mark is a solid capital A with arched, flowing sides (Arc's curved-peak
 * language as a letter); its counter is carved into a right pointing play
 * button, so the hole in the A is the play. In the wordmark the dot on the i is
 * a small play button too.
 *
 * Amber (#ffb020, the brand accent) is primary. The Circle gradient variant
 * (teal -> cyan -> purple -> blue, lifted from Circle's own logo) is kept here
 * as a saved alternate, also shown on /logos.
 */

const A_PATH =
  "M24 5 C31 12 37 26 40 43 L31.5 43 C30.5 38 29.5 35 28.5 33 L19.5 33 C18.5 35 17.5 38 16.5 43 L8 43 C11 26 17 12 24 5 Z M21 17 L21 29 L29.5 23 Z";

/* Circle's logo gradient, full diagonal. Used for the standalone gradient mark. */
function CircleGrad({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="9" y1="6" x2="39" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#33C99B" />
      <stop offset="0.34" stopColor="#34BEE6" />
      <stop offset="0.68" stopColor="#8E6CF2" />
      <stop offset="1" stopColor="#5887EE" />
    </linearGradient>
  );
}

/* Left slice of the palette (teal -> cyan), horizontal. Used on the A in the
 * gradient wordmark so the gradient reads as continuous across the whole word. */
function CircleGradH({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="8" y1="24" x2="40" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#33C99B" />
      <stop offset="1" stopColor="#36BCE4" />
    </linearGradient>
  );
}

type MarkProps = {
  className?: string;
  /* solid fill; ignored when gradId is set */
  color?: string;
  /* when set, fill with the Circle gradient under this id */
  gradId?: string;
  gradVariant?: "diag" | "horiz";
};

export function BrandMark({ className, color = "currentColor", gradId, gradVariant = "diag" }: MarkProps) {
  const fill = gradId ? `url(#${gradId})` : color;
  return (
    <svg viewBox="6 2 36 44" className={className} aria-hidden>
      {gradId && (
        <defs>{gradVariant === "horiz" ? <CircleGradH id={gradId} /> : <CircleGrad id={gradId} />}</defs>
      )}
      <path fill={fill} fillRule="evenodd" clipRule="evenodd" d={A_PATH} />
    </svg>
  );
}

/* Tiny play triangle used as the tittle of the i. */
function PlayDot({ className, fill = "currentColor" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={className} aria-hidden>
      <path fill={fill} d="M2 1.4 L2 8.6 L8.4 5 Z" />
    </svg>
  );
}

type WordmarkProps = {
  variant?: "amber" | "gradient";
  /* tailwind text-size class controlling the overall scale, e.g. "text-xl" */
  size?: string;
  /* soft radial glow behind the mark, the look from the app tile */
  glow?: boolean;
  /* luminous accent beam under the word */
  beam?: boolean;
  className?: string;
};

export function Wordmark({
  variant = "amber",
  size = "text-3xl",
  glow = false,
  beam = false,
  className = "",
}: WordmarkProps) {
  const glowEl = glow ? (
    <span
      aria-hidden
      className="pointer-events-none absolute left-0 top-1/2 h-[1.6em] w-[1.6em] -translate-x-1/4 -translate-y-1/2 rounded-full bg-[var(--accent)]/30 blur-2xl"
    />
  ) : null;

  const beamEl = beam ? (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-[0.14em] left-[0.04em] right-[0.04em] h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent"
    />
  ) : null;

  if (variant === "gradient") {
    const textGrad = { backgroundImage: "linear-gradient(95deg, #36BCE4 0%, #8E6CF2 58%, #5887EE 100%)" };
    return (
      <span className={`relative inline-flex items-baseline font-semibold tracking-tight ${size} ${className}`}>
        {glowEl}
        {beamEl}
        <BrandMark className="h-[0.82em] w-auto translate-y-[0.04em]" gradId="brand-grad-h" gradVariant="horiz" />
        <span className="-ml-[0.02em] bg-clip-text text-transparent" style={textGrad}>
          rcl
          <span className="relative inline-block" style={{ color: "#7E80EE" }}>
            {"ı"}
            <span className="absolute left-1/2 top-[0.18em] -translate-x-1/2">
              <PlayDot className="h-[0.2em] w-[0.2em]" fill="#8E6CF2" />
            </span>
          </span>
          ght
        </span>
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex items-baseline font-semibold tracking-tight text-[var(--foreground)] ${size} ${className}`}
    >
      {glowEl}
      {beamEl}
      <span className="relative text-[var(--accent)]">
        <BrandMark className="h-[0.82em] w-auto translate-y-[0.04em]" />
      </span>
      <span className="relative -ml-[0.02em]">rcl</span>
      <span className="relative inline-block">
        {"ı"}
        <span className="absolute left-1/2 top-[0.18em] -translate-x-1/2 text-[var(--accent)]">
          <PlayDot className="h-[0.2em] w-[0.2em]" />
        </span>
      </span>
      <span className="relative">ght</span>
    </span>
  );
}

/* Rounded app-tile mark with the radiating accent glow. */
export function BrandTile({
  size = "h-9 w-9",
  variant = "amber",
}: {
  size?: string;
  variant?: "amber" | "gradient";
}): ReactNode {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-[28%] border border-[var(--border-color)] bg-[#0b0f17] shadow-[0_10px_30px_-10px_rgba(255,176,32,0.6)]`}
    >
      {variant === "gradient" ? (
        <BrandMark className="h-[58%] w-auto" gradId="brand-tile-grad" />
      ) : (
        <BrandMark className="h-[58%] w-auto" color="var(--accent)" />
      )}
    </span>
  );
}
