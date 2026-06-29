import { Wordmark } from "@/components/logo";

/* Redesign direction A: Editorial & spacious. Static mockup, not wired. */

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight text-[var(--foreground)]">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
      {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-color)] pb-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className={mono ? "font-mono text-[var(--foreground)]" : "text-[var(--foreground)]"}>{value}</span>
    </div>
  );
}

function LogRow({ time, text, good }: { time: string; text: string; good?: boolean }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] text-[var(--muted)]">{time}</span>
      <span className={good ? "text-[var(--good)]" : "text-[var(--foreground)]"}>{text}</span>
    </li>
  );
}

export default function Editorial() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-6">
        <Wordmark size="text-xl" />
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" /> live on Arc testnet
        </span>
      </div>

      <section className="py-16">
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)]">
          Proof of view, paid per watch.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
          A sybil resistant proof gates real, gasless, sub cent USDC payouts to creators over Circle Gateway on Arc.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-10 border-y border-[var(--border-color)] py-10 sm:grid-cols-4">
        <Stat value="$0.01" label="Per view" />
        <Stat value="9.99" label="Gateway USDC" sub="spendable" />
        <Stat value="247" label="Paid views" />
        <Stat value="4ms" label="Settle" />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Viewer</div>
          <h2 className="mt-2 text-2xl font-semibold leading-snug tracking-tight">
            Watch the video. A real, metered view pays the creator on the spot.
          </h2>
          <div className="mt-6 grid aspect-video w-full place-items-center rounded-xl border border-[var(--border-color)] bg-[var(--surface)]">
            <button className="grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)] text-black shadow-[0_12px_40px_-8px_var(--accent)]">
              <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[1px] fill-current">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black">
              Watch &amp; pay creator
            </button>
            <button className="rounded-full border border-[var(--border-color)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)]">
              Replay same proof
            </button>
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Advertiser agent</div>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Gateway available" value="9.99 USDC" />
              <Row label="Wallet" value="29.94 USDC" />
              <Row label="Network" value="eip155:5042002" mono />
              <Row label="Agent" value="0xcF4E…754d" mono />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Settlement log</div>
            <ul className="mt-4 space-y-3 text-sm">
              <LogRow time="09:31:02" text="Attestation signed" />
              <LogRow time="09:31:02" text="Paid $0.01 · tx 0x4c…" good />
              <LogRow time="09:31:05" text="Replay blocked · nullifier consumed" good />
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--border-color)] pt-8 text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">Advertiser</span> signs proof
        <span className="text-[var(--muted)]">→</span>
        <span className="font-medium text-[var(--accent)]">ProofOfView</span> verifies + nullifies
        <span className="text-[var(--muted)]">→</span>
        <span className="font-medium text-[var(--foreground)]">Creator</span> USDC → FX / yield / bridge
      </div>
    </main>
  );
}
