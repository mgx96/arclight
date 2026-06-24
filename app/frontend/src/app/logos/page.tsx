import type { ReactNode } from "react";

/**
 * Logo concept lab, take six. Locked direction: D (wordmark) with the counter
 * of the letter A shaped as a play button. The hole in the A IS the play. One
 * glyph that works as the leading letter of the wordmark, and standalone as an
 * app tile / favicon. Flat single accent, no gradient. /logos, not linked.
 */

type MarkProps = { className?: string; color?: string };

/* Circle's logo gradient: teal -> cyan -> purple -> blue, flowing diagonally. */
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

/* Left slice of the palette (teal -> cyan), horizontal. Used on the A so the
 * gradient reads as continuous across the whole wordmark. */
function CircleGradH({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="8" y1="24" x2="40" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0" stopColor="#33C99B" />
      <stop offset="1" stopColor="#36BCE4" />
    </linearGradient>
  );
}

/* Solid capital A with arched, flowing sides (Arc's curved-peak language as a
 * letter). Splayed legs read it as an A; the counter is carved as a right
 * pointing play triangle (evenodd), so the hole in the A is the play. */
function MarkAPlay({
  className,
  color = "currentColor",
  gradId,
  gradVariant = "diag",
}: MarkProps & { gradId?: string; gradVariant?: "diag" | "horiz" }) {
  const fill = gradId ? `url(#${gradId})` : color;
  return (
    <svg viewBox="6 2 36 44" className={className} aria-hidden>
      {gradId && (
        <defs>
          {gradVariant === "horiz" ? <CircleGradH id={gradId} /> : <CircleGrad id={gradId} />}
        </defs>
      )}
      <path
        fill={fill}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 5 C31 12 37 26 40 43 L31.5 43 C30.5 38 29.5 35 28.5 33 L19.5 33 C18.5 35 17.5 38 16.5 43 L8 43 C11 26 17 12 24 5 Z M21 17 L21 29 L29.5 23 Z"
      />
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

function Lockup({ big }: { big?: boolean }) {
  return (
    <span
      className={`inline-flex items-baseline font-semibold tracking-tight text-[var(--foreground)] ${
        big ? "text-5xl" : "text-3xl"
      }`}
    >
      <span className="text-[var(--accent)]">
        <MarkAPlay className="h-[0.82em] w-auto translate-y-[0.04em]" />
      </span>
      <span className="-ml-[0.02em]">rcl</span>
      <span className="relative inline-block">
        {"ı"}
        <span className="absolute left-1/2 top-0 -translate-x-1/2 translate-y-[0.04em] text-[var(--accent)]">
          <PlayDot className="h-[0.2em] w-[0.2em]" />
        </span>
      </span>
      <span>ght</span>
    </span>
  );
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[20px] border border-[var(--border-color)] bg-[#0b0f17] shadow-[0_14px_40px_-18px_rgba(255,176,32,0.4)]">
      {children}
    </div>
  );
}

/* Wordmark in an explicit accent color, for the palette comparison. */
function ColorLockup({ accent }: { accent: string }) {
  return (
    <span className="inline-flex items-baseline text-4xl font-semibold tracking-tight text-[var(--foreground)]">
      <span style={{ color: accent }}>
        <MarkAPlay className="h-[0.82em] w-auto translate-y-[0.04em]" />
      </span>
      <span className="-ml-[0.02em]">rcl</span>
      <span className="relative inline-block">
        {"ı"}
        <span
          className="absolute left-1/2 top-0 -translate-x-1/2 translate-y-[0.04em]"
          style={{ color: accent }}
        >
          <PlayDot className="h-[0.2em] w-[0.2em]" />
        </span>
      </span>
      <span>ght</span>
    </span>
  );
}

function SwatchCol({ accent, label, hex }: { accent: string; label: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="grid h-20 w-20 place-items-center rounded-[20px] border border-[var(--border-color)] bg-[#0b0f17]">
        <MarkAPlay className="h-10 w-auto" color={accent} />
      </div>
      <ColorLockup accent={accent} />
      <div className="text-center">
        <div className="text-xs font-semibold">{label}</div>
        <div className="font-mono text-[11px] text-[var(--muted)]">{hex}</div>
      </div>
    </div>
  );
}

/* Wordmark with Circle's gradient flowing continuously across the whole word:
 * the A is the teal start, the text letters carry cyan -> purple -> blue. */
function GradLockup() {
  const textGrad = {
    backgroundImage: "linear-gradient(95deg, #36BCE4 0%, #8E6CF2 58%, #5887EE 100%)",
  };
  return (
    <span className="inline-flex items-baseline text-4xl font-semibold tracking-tight">
      <MarkAPlay className="h-[0.82em] w-auto translate-y-[0.04em]" gradId="grad-lockup" gradVariant="horiz" />
      <span className="-ml-[0.02em] bg-clip-text text-transparent" style={textGrad}>
        rcl
        <span className="relative inline-block" style={{ color: "#7E80EE" }}>
          {"ı"}
          <span className="absolute left-1/2 top-0 -translate-x-1/2 translate-y-[0.04em]">
            <PlayDot className="h-[0.2em] w-[0.2em]" fill="#8E6CF2" />
          </span>
        </span>
        ght
      </span>
    </span>
  );
}

function GradSwatchCol() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="grid h-20 w-20 place-items-center rounded-[20px] border border-[var(--border-color)] bg-[#0b0f17]">
        <MarkAPlay className="h-10 w-auto" gradId="grad-tile" />
      </div>
      <GradLockup />
      <div className="text-center">
        <div className="text-xs font-semibold">Circle gradient</div>
        <div className="font-mono text-[11px] text-[var(--muted)]">teal → cyan → purple → blue</div>
      </div>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/80 p-6 backdrop-blur">
      <div className="mb-6 text-sm font-semibold">{title}</div>
      {children}
      <p className="mt-6 text-xs text-[var(--muted)]">{note}</p>
    </section>
  );
}

export default function LogoLab() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Arclight, the A is the play</h1>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        Direction D, refined. The counter of the letter A is carved into a play button, so the hole in the A is the
        play. One glyph: it leads the wordmark and stands alone as a tile and favicon. Say go and I wire it in.
      </p>

      <div className="mt-8 space-y-4">
        <Block
          title="Arclight amber vs Circle gradient"
          note="Same glyph, side by side. The Circle gradient flows teal to cyan to purple to blue, lifted from Circle's own logo. Just exploring the swap."
        >
          <div className="flex flex-wrap items-start gap-16">
            <SwatchCol accent="#ffb020" label="Arclight amber (current)" hex="#FFB020" />
            <GradSwatchCol />
          </div>
        </Block>

        <Block
          title="The wordmark"
          note="Custom A glyph leads the word, set tight, with a luminous beam underneath. This is the primary lockup."
        >
          <div className="relative inline-block">
            <Lockup big />
            <span className="pointer-events-none absolute -bottom-2 left-1 right-1 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
          </div>
        </Block>

        <Block
          title="The mark, every size"
          note="The same glyph as a gradient-free app tile, a monochrome mark, and at favicon scale. The play counter stays legible all the way down."
        >
          <div className="flex flex-wrap items-center gap-10">
            <Tile>
              <MarkAPlay className="h-10 w-auto" color="var(--accent)" />
            </Tile>
            <MarkAPlay className="h-14 w-auto shrink-0" color="var(--accent)" />
            <MarkAPlay className="h-8 w-auto shrink-0" color="var(--accent)" />
            <MarkAPlay className="h-5 w-auto shrink-0" color="var(--accent)" />
          </div>
        </Block>

        <Block
          title="On dark and on light"
          note="Foreground neutral, accent fill. Reads cleanly on the app surface in either theme."
        >
          <div className="flex flex-wrap items-center gap-6">
            <div className="grid h-20 w-32 place-items-center rounded-xl bg-[#06080d]">
              <MarkAPlay className="h-12 w-auto" color="#ffb020" />
            </div>
            <div className="grid h-20 w-32 place-items-center rounded-xl bg-[#f5f6fb]">
              <MarkAPlay className="h-12 w-auto" color="#e6920a" />
            </div>
            <div className="grid h-20 w-32 place-items-center rounded-xl bg-[#0b0f17]">
              <MarkAPlay className="h-12 w-auto" color="#e9edf5" />
            </div>
          </div>
        </Block>
      </div>
    </main>
  );
}
