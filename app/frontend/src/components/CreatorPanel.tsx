"use client";

import { Panel, Stat, Addr, Pill } from "./ui";
import { useDemo } from "./demo-store";
import { CONTRACTS } from "@/lib/chain";

export function CreatorPanel() {
  const { receipts, config } = useDemo();

  const total = receipts.reduce((sum, r) => sum + Number(r.formattedAmount), 0);

  return (
    <Panel
      title="Creator"
      subtitle="Gets paid in USDC per view, then moves the earnings through Circle's stablecoin rails."
      accent="x402 seller"
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Earnings" value={`${total.toFixed(6)} USDC`} hint={`${receipts.length} paid view${receipts.length === 1 ? "" : "s"}`} />
        <Stat label="Payout wallet" value={<Addr value={config?.addresses.creator} />} />
      </div>

      {/* live receipts feed */}
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">Settlements</div>
        <div className="scroll-slim max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {receipts.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-4 text-center text-xs text-[var(--muted)]">
              No views yet. Play the video to fire the first nanopayment.
            </div>
          )}
          {receipts
            .slice()
            .reverse()
            .map((r) => (
              <div
                key={r.transaction}
                className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-[var(--foreground)]">+{r.formattedAmount} USDC</div>
                  <div className="font-mono text-[10px] text-[var(--muted)]">
                    view {r.viewId.slice(0, 10)}… · tx {r.transaction.slice(0, 8)}…
                  </div>
                </div>
                <Pill tone="good">settled</Pill>
              </div>
            ))}
        </div>
      </div>

      {/* payout rails: real, deployed modules */}
      <div className="mt-4">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">Payout rails (deployed on Arc)</div>
        <div className="grid grid-cols-1 gap-1.5">
          <Rail name="Convert → EURC" desc="StableFX maker settled FX" addr={CONTRACTS.StableFxPayoutRouter} />
          <Rail name="Earn yield" desc="USYC via CreatorTreasury" addr={CONTRACTS.CreatorTreasury} />
          <Rail name="Bridge out" desc="CCTP V2 cross chain" addr={CONTRACTS.ArcCctpGateway} />
        </div>
      </div>
    </Panel>
  );
}

function Rail({ name, desc, addr }: { name: string; desc: string; addr: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/40 px-3 py-2">
      <div>
        <div className="text-xs font-medium text-[var(--foreground)]">{name}</div>
        <div className="text-[10px] text-[var(--muted)]">{desc}</div>
      </div>
      <Addr value={addr} />
    </div>
  );
}
