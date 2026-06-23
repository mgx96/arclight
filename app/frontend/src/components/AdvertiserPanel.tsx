"use client";

import { Panel, Stat, Addr, Button, Pill } from "./ui";
import { useDemo } from "./demo-store";

export function AdvertiserPanel() {
  const { config, balances, campaignId, setCampaignId, refresh, busy } = useDemo();

  const available = balances?.gateway.available ?? "—";
  const wallet = balances?.wallet.formatted ?? "—";

  return (
    <Panel
      title="Advertiser agent"
      subtitle="Pays creators per genuine view, straight from a Circle Gateway balance."
      accent="Gateway buyer"
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Gateway available" value={`${available} USDC`} hint="spendable on nanopayments" />
        <Stat label="Wallet USDC" value={`${wallet}`} hint="on Arc testnet" />
      </div>

      <div className="mt-3 space-y-2 text-xs">
        <Row label="Agent">
          <Addr value={config?.addresses.agent} />
        </Row>
        <Row label="Network">
          <span className="font-mono text-[var(--muted)]">{config?.chain.caip2 ?? "eip155:5042002"}</span>
        </Row>
        <Row label="Campaign">
          <div className="flex items-center gap-2">
            <button
              className="h-6 w-6 rounded-md border border-[var(--border-color)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setCampaignId(Math.max(1, campaignId - 1))}
            >
              −
            </button>
            <span className="font-mono text-[var(--foreground)]">#{campaignId}</span>
            <button
              className="h-6 w-6 rounded-md border border-[var(--border-color)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
              onClick={() => setCampaignId(campaignId + 1)}
            >
              +
            </button>
            <span className="text-[var(--muted)]">switch campaign to mint fresh nullifiers</span>
          </div>
        </Row>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Pill tone={Number(balances?.gateway.available ?? 0) > 0 ? "good" : "bad"}>
          {Number(balances?.gateway.available ?? 0) > 0 ? "funded & ready" : "needs deposit"}
        </Pill>
        <Button variant="ghost" onClick={() => void refresh()} disabled={busy}>
          ↻ Refresh
        </Button>
      </div>

      <p className="mt-3 text-[11px] text-[var(--muted)]">
        Top up from the terminal: <span className="font-mono text-[var(--accent-soft)]">pnpm deposit 5</span> in{" "}
        <span className="font-mono">app/backend</span>.
      </p>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <div>{children}</div>
    </div>
  );
}
