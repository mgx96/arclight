import { Wordmark } from "@/components/logo";

/* Redesign direction C: Pro terminal. Dense, monospace, data-first. Static mockup. */

function Cell({ label, value, accent, good }: { label: string; value: string; accent?: boolean; good?: boolean }) {
  return (
    <div className="border border-[var(--border-color)] bg-[var(--surface)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
      <div
        className={`mt-1 font-mono text-lg ${
          good ? "text-[var(--good)]" : accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Line({ time, tag, text, tone }: { time: string; tag: string; text: string; tone?: "good" | "accent" | "muted" }) {
  const tagColor =
    tone === "good" ? "text-[var(--good)]" : tone === "accent" ? "text-[var(--accent)]" : "text-[var(--muted)]";
  return (
    <div className="flex items-baseline gap-3 px-3 py-1.5 odd:bg-white/[0.02]">
      <span className="text-[var(--muted)]">{time}</span>
      <span className={`w-28 shrink-0 ${tagColor}`}>{tag}</span>
      <span className="text-[var(--foreground)]">{text}</span>
    </div>
  );
}

export default function Terminal() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 font-mono text-sm">
      {/* command bar */}
      <header className="flex items-center justify-between border border-[var(--border-color)] bg-[var(--surface)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Wordmark size="text-lg" />
          <span className="text-[var(--muted)]">// proof-of-view settlement</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--good)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" /> ONLINE
          </span>
          <span className="text-[var(--muted)]">chain=eip155:5042002</span>
          <span className="text-[var(--muted)]">block #1,284,991</span>
        </div>
      </header>

      {/* metric strip */}
      <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--border-color)] sm:grid-cols-5">
        <Cell label="per_view" value="$0.0100" accent />
        <Cell label="gateway_usdc" value="9.99" />
        <Cell label="wallet_usdc" value="29.94" />
        <Cell label="paid_views" value="247" good />
        <Cell label="settle_ms" value="4" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* viewer / exec */}
        <section className="border border-[var(--border-color)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border-color)] px-4 py-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            viewer.exec
          </div>
          <div className="p-4">
            <div className="grid aspect-video w-full place-items-center border border-[var(--border-color)] bg-black/40">
              <button className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-black">
                <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[1px] fill-current">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button className="border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-left text-[var(--accent)]">
                $ watch --pay-creator
              </button>
              <button className="border border-[var(--border-color)] px-4 py-2 text-left text-[var(--muted)]">
                $ replay --same-proof
              </button>
            </div>
            <div className="mt-4 space-y-1 text-xs text-[var(--muted)]">
              <div>attestor = 0xcF4E…754d <span className="text-[var(--good)]">[trusted]</span></div>
              <div>nullifier = 0x9a1f…e02b <span className="text-[var(--good)]">[fresh]</span></div>
            </div>
          </div>
        </section>

        {/* settlement log */}
        <section className="border border-[var(--border-color)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-2">
            <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">settlement.log</span>
            <span className="text-xs text-[var(--muted)]">tail -f</span>
          </div>
          <div className="py-2 text-xs">
            <Line time="09:31:02" tag="ATTEST" text="proof signed by advertiser agent" tone="muted" />
            <Line time="09:31:02" tag="VERIFY" text="ProofOfView.verify() → ok" tone="accent" />
            <Line time="09:31:02" tag="PAY" text="0.01 USDC → creator · tx 0x4c…91" tone="good" />
            <Line time="09:31:02" tag="NULLIFY" text="nullifier consumed" tone="good" />
            <Line time="09:31:05" tag="REPLAY" text="blocked · nullifier already spent" tone="good" />
            <Line time="09:31:09" tag="ATTEST" text="proof signed by advertiser agent" tone="muted" />
            <Line time="09:31:09" tag="PAY" text="0.01 USDC → creator · tx 0x7d…2a" tone="good" />
          </div>
        </section>
      </div>

      {/* pipeline */}
      <div className="mt-4 border border-[var(--border-color)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">
        <span className="text-[var(--foreground)]">advertiser</span> —signs→{" "}
        <span className="text-[var(--accent)]">ProofOfView</span> —verify+nullify→{" "}
        <span className="text-[var(--foreground)]">creator</span> —route→ FX | yield | bridge
      </div>
    </main>
  );
}
