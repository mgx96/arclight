"use client";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui";
import { useDemo, type PayoutAction, type PayoutRecord } from "@/components/demo-store";

const ACTION_META: Record<PayoutAction, { label: string; tint: string }> = {
  withdraw: { label: "Withdraw", tint: "bg-[var(--accent)]/15 text-[var(--accent-soft)]" },
  move: { label: "Deposit", tint: "bg-sky-400/15 text-sky-300" },
  bridge: { label: "Bridge", tint: "bg-violet-400/15 text-violet-300" },
  send: { label: "Send", tint: "bg-emerald-400/15 text-emerald-300" },
};

function fmtWhen(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A dedicated page listing every money move made from the Transfers widget — what button was pressed,
// the amount, when, and a click-through to the block explorer. Records are kept client-side in
// localStorage (the backend doesn't persist a per-user ledger), so this survives reloads on this device.
export default function HistoryPage() {
  const { payouts, clearPayouts } = useDemo();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        accent="Your transfers"
        title="Payout history"
        lead="Every Withdraw, Move, Bridge and Send you've made, newest first, each with its on-chain transaction."
        back={{ href: "/creator", label: "Back to transfers" }}
      />

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] px-6 py-12 text-center text-sm text-[var(--muted)]">
          No transfers yet. Head to{" "}
          <a href="/creator" className="text-[var(--accent-soft)] underline-offset-2 hover:underline">
            Transfers
          </a>{" "}
          and Withdraw, Move, Bridge or Send — each one shows up here with its transaction hash.
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {payouts.length} transfer{payouts.length === 1 ? "" : "s"}
            </div>
            <Button variant="ghost" onClick={clearPayouts}>
              Clear history
            </Button>
          </div>

          {/* column legend */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
            <span>Action</span>
            <span>Amount · when</span>
            <span className="text-right">Transaction</span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/40">
            {payouts.map((p, i) => (
              <HistoryRow key={p.id} record={p} divide={i > 0} />
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
            This list lives in your browser on this device. It records the actions you take here; it isn&apos;t a
            chain-wide ledger. Each transaction link opens the block explorer where the transfer is final.
          </p>
        </>
      )}
    </div>
  );
}

function HistoryRow({ record, divide }: { record: PayoutRecord; divide: boolean }) {
  const meta = ACTION_META[record.action];
  return (
    <div
      className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 ${
        divide ? "border-t border-[var(--border-color)]" : ""
      }`}
    >
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${meta.tint}`}>{meta.label}</span>

      <div className="min-w-0">
        <div className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
          {Number(record.amount).toFixed(2)} USDC
        </div>
        <div className="truncate text-[11px] text-[var(--muted)]">
          {fmtWhen(record.at)} · {record.status}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {record.links.length === 0 ? (
          <span className="text-[11px] text-[var(--muted)]">no tx</span>
        ) : (
          record.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--accent-soft)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/10"
            >
              {l.label}
            </a>
          ))
        )}
      </div>
    </div>
  );
}
