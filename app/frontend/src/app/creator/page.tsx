"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { TransfersWidget } from "@/components/TransfersWidget";
import { WalletConnect } from "@/components/WalletConnect";
import { Button } from "@/components/ui";
import { useDemo } from "@/components/demo-store";
import { useWalletBalance } from "@/lib/useWalletBalance";

export default function TransfersPage() {
  const { busy, refresh } = useDemo();
  const wallet = useWalletBalance();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        accent="Move your money"
        title="Transfers"
        lead="Everything that moves USDC lives here, one action at a time. Pick a tab, choose an amount, done."
        back={{ href: "/", label: "Back to dashboard" }}
      />

      {/* YOUR connected wallet: live, updates the moment you connect or switch wallets */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Your wallet</div>
          {wallet.isConnected && wallet.address ? (
            <>
              <div className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                {wallet.usdc == null ? (wallet.isLoading ? "…" : "—") : `${wallet.usdc.toFixed(2)} USDC`}
              </div>
              <div className="font-mono text-[11px] text-[var(--muted)]">
                {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} · live on Arc
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-sm text-[var(--muted)]">Connect a wallet to see its live balance.</div>
          )}
        </div>
        {!wallet.isConnected && <WalletConnect />}
      </div>

      {/* The DEMO CREATOR identity the backend signs for: this is what earns and what Withdraw/Move act on.
          The per-stage balances now live inside the widget's flow strip, so we only label whose money it is. */}
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        Demo creator · the seller the backend signs for
      </div>

      <TransfersWidget />

      <div className="mt-3 flex items-center justify-between">
        <Link
          href="/history"
          className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--foreground)] hover:underline"
        >
          View payout history →
        </Link>
        <Button variant="ghost" onClick={() => { void refresh(); void wallet.refetch(); }} disabled={busy}>
          ↻ Refresh balances
        </Button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
        Heads up: earnings accrue to the demo creator identity above, because that is the one key the
        backend can sign Gateway payouts and withdrawals with. Withdraw settles that Gateway balance
        straight into your connected wallet; Bridge and Send deliver to your connected wallet (or any
        address you type).
      </p>
    </div>
  );
}
