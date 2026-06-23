"use client";

import { DemoProvider, useDemo } from "@/components/demo-store";
import { AdvertiserPanel } from "@/components/AdvertiserPanel";
import { ViewerPanel } from "@/components/ViewerPanel";
import { CreatorPanel } from "@/components/CreatorPanel";
import { ProofPanel } from "@/components/ProofPanel";
import { EventLog } from "@/components/EventLog";
import { Pill } from "@/components/ui";

export default function Page() {
  return (
    <DemoProvider>
      <Dashboard />
    </DemoProvider>
  );
}

function Dashboard() {
  const { backendUp, attestorTrusted } = useDemo();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-black">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2l9 19H3z" /></svg>
            </span>
            <h1 className="text-xl font-bold tracking-tight">Arclight</h1>
            <span className="text-sm text-[var(--muted)]">proof of view nanopayments</span>
          </div>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Monetization for open video, built on stablecoins. A sybil resistant proof of view gates real, gasless,
            sub cent USDC payouts to creators over Circle Gateway on Arc.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={backendUp === true ? "good" : backendUp === false ? "bad" : "muted"}>
            {backendUp === true ? "backend live" : backendUp === false ? "backend offline" : "connecting…"}
          </Pill>
          <Pill tone={attestorTrusted ? "good" : "muted"}>
            {attestorTrusted ? "attestor verified onchain" : "Arc testnet"}
          </Pill>
        </div>
      </header>

      {/* money-flow strip */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/60 px-4 py-3 text-xs">
        <Node label="Advertiser agent" sub="Gateway balance" />
        <Arrow text="signs proof" />
        <Node label="ProofOfView" sub="verifies + nullifies" highlight />
        <Arrow text="nanopayment" />
        <Node label="Creator" sub="USDC → FX / yield / bridge" />
      </div>

      {/* panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ViewerPanel />
        </div>
        <AdvertiserPanel />
        <ProofPanel />
        <CreatorPanel />
        <EventLog />
      </div>

      <footer className="mt-8 text-center text-[11px] text-[var(--muted)]">
        Live on Arc testnet · contracts source verified on Arcscan · built for the Circle Arc Builders Fund
      </footer>
    </main>
  );
}

function Node({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={`shrink-0 rounded-xl border px-3 py-1.5 ${
        highlight
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
          : "border-[var(--border-color)] bg-[var(--surface-2)]/40"
      }`}
    >
      <div className={`text-xs font-semibold ${highlight ? "text-[var(--accent-soft)]" : "text-[var(--foreground)]"}`}>
        {label}
      </div>
      <div className="text-[10px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}

function Arrow({ text }: { text: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center px-1 text-[var(--muted)]">
      <span className="text-[9px] uppercase tracking-widest">{text}</span>
      <span className="text-base leading-none">→</span>
    </div>
  );
}
