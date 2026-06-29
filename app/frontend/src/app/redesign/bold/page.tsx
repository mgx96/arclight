import { Wordmark } from "@/components/logo";

/* Redesign direction D: Bold gradient brand. Big type, saturated accent, confident. Static mockup. */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-5 py-4 ring-1 ring-inset ring-white/10">
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">{label}</div>
    </div>
  );
}

export default function Bold() {
  return (
    <main className="w-full flex-1">
      {/* hero band with brand gradient */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: "linear-gradient(135deg, #1a1207 0%, #2a1e0a 40%, #0b0f17 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 -z-10 h-[34rem] w-[34rem] rounded-full opacity-50 blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
        />

        <div className="mx-auto w-full max-w-6xl px-6 py-7">
          <header className="flex items-center justify-between">
            <Wordmark size="text-xl" glow beam />
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" /> live on Arc testnet
              </span>
            </div>
          </header>

          <div className="grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--accent)]">
                Circle Arc Builders Fund
              </div>
              <h1 className="mt-5 text-6xl font-bold leading-[0.98] tracking-tight text-white">
                Paid
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(95deg, var(--accent), #ffd178)" }}
                >
                  per watch.
                </span>
              </h1>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
                A sybil resistant proof of view gates real, gasless, sub cent USDC payouts to creators over Circle
                Gateway on Arc.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black shadow-[0_16px_50px_-12px_var(--accent)]">
                  Watch &amp; pay creator
                </button>
                <button className="rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white ring-1 ring-inset ring-white/15">
                  Replay same proof
                </button>
              </div>
            </div>

            <div className="grid aspect-video w-full place-items-center rounded-3xl bg-black/30 ring-1 ring-inset ring-white/10">
              <button className="grid h-20 w-20 place-items-center rounded-full bg-[var(--accent)] text-black shadow-[0_20px_60px_-10px_var(--accent)]">
                <svg viewBox="0 0 24 24" className="h-9 w-9 translate-x-[1px] fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-12 sm:grid-cols-4">
            <Stat value="$0.01" label="Per view" />
            <Stat value="9.99" label="Gateway USDC" />
            <Stat value="247" label="Paid views" />
            <Stat value="4ms" label="Settle" />
          </div>
        </div>
      </section>

      {/* lower content on app surface */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Advertiser agent</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                <span className="text-[var(--muted)]">Gateway</span>
                <span className="font-mono text-[var(--foreground)]">9.99 USDC</span>
              </div>
              <div className="flex justify-between border-b border-[var(--border-color)] pb-2">
                <span className="text-[var(--muted)]">Wallet</span>
                <span className="font-mono text-[var(--foreground)]">29.94 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Agent</span>
                <span className="font-mono text-[var(--foreground)]">0xcF4E…754d</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-6">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">ProofOfView</div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--foreground)]">
              Verifies the attestation onchain and consumes the nullifier so each proof pays exactly once.
            </p>
            <div className="mt-4 font-mono text-xs text-[var(--good)]">verify() → ok · nullified ✓</div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)] p-6">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Settlement log</div>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-[var(--muted)]">09:31:02</span>
                <span className="text-[var(--foreground)]">Attestation signed</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-[var(--muted)]">09:31:02</span>
                <span className="text-[var(--good)]">Paid $0.01 · tx 0x4c…</span>
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-[var(--muted)]">09:31:05</span>
                <span className="text-[var(--good)]">Replay blocked</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
