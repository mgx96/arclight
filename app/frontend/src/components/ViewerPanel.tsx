"use client";

import { useRef, useState } from "react";
import { Panel, Button, Pill } from "./ui";
import { useDemo } from "./demo-store";

const WATCH_MS = 3200; // simulated metered watch time before a view counts as genuine

export function ViewerPanel() {
  const { watchAndPay, replayLast, busy, lastProof, config, backendUp, campaignId } = useDemo();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const raf = useRef<number | null>(null);

  const disabled = busy || playing || backendUp !== true;

  function startWatch() {
    const viewerSecret = `viewer-${Math.random().toString(36).slice(2, 8)}`;
    setViewer(viewerSecret);
    setPlaying(true);
    setProgress(0);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / WATCH_MS);
      setProgress(p);
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        void watchAndPay(viewerSecret);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }

  return (
    <Panel
      title="Viewer"
      subtitle="Watch the video. A real, metered view pays the creator on the spot."
      accent="x402 buyer"
    >
      {/* mock player */}
      <div className="relative aspect-video overflow-hidden rounded-xl border border-[var(--border-color)] bg-gradient-to-br from-[#0b1020] to-[#101a2e]">
        <div className="absolute inset-0 grid place-items-center">
          {!playing && progress === 0 && (
            <button
              onClick={startWatch}
              disabled={disabled}
              className={`grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)] text-black shadow-lg transition hover:bg-[var(--accent-soft)] disabled:opacity-40 ${
                !disabled ? "pulse-ring" : ""
              }`}
              aria-label="Play"
            >
              <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current"><path d="M8 5v14l11-7z" /></svg>
            </button>
          )}
          {playing && (
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-[var(--accent-soft)]">metering view…</div>
              <div className="mt-1 font-mono text-2xl text-[var(--foreground)]">{Math.round(progress * 100)}%</div>
            </div>
          )}
          {!playing && progress >= 1 && (
            <div className="text-center">
              <div className="text-3xl">✅</div>
              <div className="mt-1 text-xs text-[var(--muted)]">view complete</div>
            </div>
          )}
        </div>
        {/* progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-75"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Pill tone="accent">CAMPAIGN #{campaignId}</Pill>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={startWatch} disabled={disabled}>
          {busy ? "Paying creator…" : "▶ Watch & pay creator"}
        </Button>
        <Button variant="ghost" onClick={() => void replayLast()} disabled={busy || !lastProof}>
          Replay same proof (double spend test)
        </Button>
        {viewer && (
          <span className="font-mono text-[11px] text-[var(--muted)]">viewer: {viewer}</span>
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        Every watch mints a fresh signed proof of view. The agent checks it, then sends{" "}
        <span className="text-[var(--accent-soft)]">{config?.viewPrice ?? "$0.01"}</span> in USDC to the creator over
        Circle Gateway, gasless and sub cent. Run the same proof twice and the nullifier shuts it down.
      </p>
    </Panel>
  );
}
