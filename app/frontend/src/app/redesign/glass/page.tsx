import { Wordmark } from "@/components/logo";

/* Redesign direction B: Glass & depth. Static mockup, not wired. */

function Glass({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
    </div>
  );
}

export default function Glassmorphic() {
  return (
    <main className="relative isolate min-h-screen w-full flex-1 overflow-hidden">
      {/* ambient color field */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[var(--accent)]/25 blur-[120px]" />
        <div className="absolute right-[-10rem] top-24 h-[26rem] w-[26rem] rounded-full bg-[#8E6CF2]/25 blur-[120px]" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-[#34BEE6]/20 blur-[130px]" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="flex items-center justify-between">
          <Wordmark size="text-xl" glow />
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--muted)] backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" /> live
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[var(--muted)] backdrop-blur-xl">
              Arc testnet
            </span>
          </div>
        </header>

        <section className="mt-12 max-w-2xl">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
            Proof of view, paid per watch.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">
            A sybil resistant proof gates real, gasless, sub cent USDC payouts to creators over Circle Gateway on Arc.
          </p>
        </section>

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Glass>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Viewer</div>
              <span className="rounded-full bg-[var(--accent)]/15 px-2.5 py-1 text-[11px] font-medium text-[var(--accent-soft)]">
                metered
              </span>
            </div>
            <div className="grid aspect-video w-full place-items-center rounded-xl border border-white/10 bg-black/30">
              <button className="grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)] text-black shadow-[0_16px_50px_-8px_var(--accent)]">
                <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[1px] fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_var(--accent)]">
                Watch &amp; pay creator
              </button>
              <button className="rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] backdrop-blur-xl">
                Replay same proof
              </button>
            </div>
          </Glass>

          <div className="grid grid-rows-[auto_1fr] gap-5">
            <Glass>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Advertiser agent</div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Stat value="9.99" label="Gateway USDC" />
                <Stat value="29.94" label="Wallet USDC" />
              </div>
              <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-xs text-[var(--muted)]">
                <div className="flex justify-between">
                  <span>Network</span>
                  <span className="font-mono text-[var(--foreground)]">eip155:5042002</span>
                </div>
                <div className="flex justify-between">
                  <span>Agent</span>
                  <span className="font-mono text-[var(--foreground)]">0xcF4E…754d</span>
                </div>
              </div>
            </Glass>

            <Glass>
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
                  <span className="text-[var(--good)]">Replay blocked · nullifier consumed</span>
                </li>
              </ul>
            </Glass>
          </div>
        </div>

        <Glass className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">Advertiser</span> signs proof
          <span>→</span>
          <span className="font-medium text-[var(--accent)]">ProofOfView</span> verifies + nullifies
          <span>→</span>
          <span className="font-medium text-[var(--foreground)]">Creator</span> USDC → FX / yield / bridge
        </Glass>
      </div>
    </main>
  );
}
