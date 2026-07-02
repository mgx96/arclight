"use client";

import { useState } from "react";
import Link from "next/link";
import { ViewerPanel } from "@/components/ViewerPanel";
import { AdvertiserPanel } from "@/components/AdvertiserPanel";
import { ProofPanel } from "@/components/ProofPanel";
import { useDemo } from "@/components/demo-store";

// One screen, one story: watch a video, the creator gets paid in USDC, and it can't be gamed. The
// technical proof (advertiser agent, attestation fields) sits folded away under "Under the hood" so a
// first time visitor sees the demo, not a wall of panels.
export default function Page() {
  const { config, receipts, attestorTrusted } = useDemo();
  const price = config?.viewPrice ?? "$0.01";
  const earned = receipts.reduce((sum, r) => sum + Number(r.formattedAmount), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      {/* hero */}
      <section className="pt-6 text-center sm:pt-8">
        <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)] sm:text-4xl">
          Get paid per view, in stablecoins.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--muted)]">
          Watch the video below. A genuine, metered view pays the creator {price} in USDC over Circle Gateway on Arc,
          gasless and sub cent, and a bot can never farm it.
        </p>
      </section>

      {/* the demo: the player */}
      <ViewerPanel />

      {/* three step trust strip */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Step n="1" title="Genuine view" desc="metered, then attested" />
        <Step n="2" title="Sybil proof" desc={attestorTrusted ? "verified onchain ✓" : "signed + nullified"} good={!!attestorTrusted} />
        <Step n="3" title="Creator paid" desc="USDC, gasless" />
      </div>

      {/* earnings + path to money moves */}
      <Link
        href="/creator"
        className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface)]/40 px-4 py-3 transition hover:border-[var(--accent)]/40"
      >
        <div>
          <div className="text-sm font-semibold text-[var(--foreground)]">
            Creator earned {earned.toFixed(2)} USDC
            <span className="ml-2 font-normal text-[var(--muted)]">
              · {receipts.length} paid view{receipts.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="text-xs text-[var(--muted)]">Withdraw, move, bridge, or send it on the Transfers page.</div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition group-hover:bg-[var(--accent-soft)]">
          Transfers →
        </span>
      </Link>

      {/* technical substance, folded away */}
      <UnderTheHood />
    </div>
  );
}

function Step({ n, title, desc, good }: { n: string; title: string; desc: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface)]/30 px-2 py-3">
      <div className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)]/15 text-[11px] font-semibold text-[var(--accent-soft)]">
        {n}
      </div>
      <div className="mt-2 text-xs font-semibold text-[var(--foreground)]">{title}</div>
      <div className={`text-[11px] ${good ? "text-[var(--good)]" : "text-[var(--muted)]"}`}>{desc}</div>
    </div>
  );
}

function UnderTheHood() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface)]/30 px-4 py-2.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        Under the hood
        <span className={`transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <AdvertiserPanel />
          <ProofPanel />
        </div>
      )}
    </div>
  );
}
