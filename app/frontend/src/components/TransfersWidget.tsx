"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ActionCard } from "./ActionCard";
import { RecipientField } from "./RecipientField";
import { WalletConnect } from "./WalletConnect";
import { Addr } from "./ui";
import { useDemo } from "./demo-store";

type TabKey = "withdraw" | "bridge" | "send";

const TABS: { key: TabKey; label: string }[] = [
  { key: "withdraw", label: "Withdraw" },
  { key: "bridge", label: "Bridge" },
  { key: "send", label: "Send" },
];

const GAS_RESERVE = 0.02;

// Which pipeline stage each action draws its "available" balance from. This is the whole point of the
// flow strip: the actions look like they read different numbers, but they're really one chain of
// stages — Gateway credit → your wallet → the managed wallet → out. Bridge and Send top the managed
// wallet up from your wallet on demand (the old Deposit step, folded in), so they read the managed stage.
type StageKey = "gateway" | "wallet" | "managed";
const SOURCE_STAGE: Record<TabKey, StageKey> = {
  withdraw: "gateway",
  bridge: "managed",
  send: "managed",
};

// One widget, three money moves, switched by a segmented control at the top — the same shape wallets and
// bridges (Across, Stargate, Uniswap) use, so a new user only ever sees one action at a time.
export function TransfersWidget() {
  const [tab, setTab] = useState<TabKey>("withdraw");

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/40 p-2 sm:p-3">
      {/* segmented control */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-2)]/50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-2 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-[var(--accent)] text-black shadow-[0_6px_18px_-8px_var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* One shared money pipeline, always visible, so it's obvious the four actions read sequential
          stages of the same balance rather than four unrelated sources. */}
      <BalanceFlow active={SOURCE_STAGE[tab]} />

      <div className="p-2 sm:p-3">
        {tab === "withdraw" && <WithdrawBody />}
        {tab === "bridge" && <BridgeBody />}
        {tab === "send" && <SendBody />}
      </div>
    </div>
  );
}

// The pipeline strip: Gateway credit → your wallet (Arc) → managed Circle wallet → out. The stage the
// active tab pulls from is highlighted, so "different numbers per tab" reads as "different stage", not
// "different source of truth".
function BalanceFlow({ active }: { active: StageKey }) {
  const { creatorBalances, treasury } = useDemo();
  const gateway = Number(creatorBalances?.gateway.available ?? 0);
  const wallet = Number(creatorBalances?.wallet.formatted ?? 0);
  const managed = treasury?.configured ? Number(treasury.usdc) : null;

  const nodes: { key: StageKey; label: string; value: number | null }[] = [
    { key: "gateway", label: "Gateway", value: gateway },
    { key: "wallet", label: "Wallet", value: wallet },
    { key: "managed", label: "Managed", value: managed },
  ];

  return (
    <div className="mt-2 flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/30 px-2 py-2">
      {nodes.map((n, i) => (
        <div key={n.key} className="flex items-center gap-1">
          <div
            className={`min-w-0 rounded-lg px-2.5 py-1.5 text-center transition ${
              active === n.key
                ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/50"
                : "opacity-70"
            }`}
          >
            <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{n.label}</div>
            <div
              className={`text-sm font-semibold tabular-nums ${
                active === n.key ? "text-[var(--accent-soft)]" : "text-[var(--foreground)]"
              }`}
            >
              {n.value == null ? "—" : n.value.toFixed(2)}
            </div>
          </div>
          {i < nodes.length - 1 && <span className="px-0.5 text-xs text-[var(--muted)]">→</span>}
        </div>
      ))}
      <span className="px-0.5 text-xs text-[var(--muted)]">→</span>
      <div className="rounded-lg px-2 py-1.5 text-center opacity-70">
        <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Out</div>
        <div className="text-sm text-[var(--muted)]">↗</div>
      </div>
    </div>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-[var(--muted)]">{children}</p>;
}

function Dormant({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-6 text-sm text-[var(--muted)]">
      {what} is off until the managed Circle wallet is configured. Set{" "}
      <span className="font-mono text-[var(--accent-soft)]">CIRCLE_API_KEY</span> and a registered{" "}
      <span className="font-mono text-[var(--accent-soft)]">CIRCLE_ENTITY_SECRET</span> in the backend to turn it on.
    </div>
  );
}

const SHOWCASE = process.env.NEXT_PUBLIC_SHOWCASE === "1";

function WithdrawBody() {
  const { creatorBalances, withdrawCreator, withdrawing, busy } = useDemo();
  const { address, isConnected } = useAccount();
  const credited = Number(creatorBalances?.gateway.available ?? 0);
  // The static showcase has no wallet to connect, so allow the withdraw and settle to a demo address.
  const gateOk = isConnected || SHOWCASE;
  return (
    <>
      <Lead>
        Your per view payments get batched by Circle Gateway into a credited balance, gaslessly. Withdraw mints that
        straight into your connected wallet on Arc — one instant hop, one fee.
      </Lead>
      {!isConnected && !SHOWCASE && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] px-3 py-2.5 text-sm text-[var(--muted)]">
          <span>Connect a wallet to withdraw into it.</span>
          <WalletConnect />
        </div>
      )}
      <ActionCard
        from="Gateway balance"
        to="Your wallet (Arc)"
        available={credited}
        cta="Withdraw"
        busyLabel="Withdrawing…"
        busy={withdrawing}
        disabled={busy || !gateOk}
        emptyHint="Nothing credited yet. Your earnings show up here a moment after each view. Watch the video on the dashboard to earn some."
        onRun={(amount) => void withdrawCreator(amount, address)}
        footer="Same chain, instant. The credited balance becomes normal USDC in your connected wallet."
      />
    </>
  );
}

function BridgeBody() {
  const { creatorBalances, treasury, config, bridgeToSepolia, bridging, busy } = useDemo();
  const { address } = useAccount();
  const [manual, setManual] = useState("");
  const treasuryUsdc = treasury?.configured ? Number(treasury.usdc) : 0;
  const walletUsdc = Number(creatorBalances?.wallet.formatted ?? 0);
  // Bridge tops the managed wallet up from your Arc wallet first (the folded-in deposit), so what's
  // bridgeable is the managed balance plus your wallet, each minus its own Arc-gas reserve.
  const bridgeable = Math.max(0, treasuryUsdc + Math.max(0, walletUsdc - GAS_RESERVE) - GAS_RESERVE);
  const fallback = config?.addresses.creator ?? "";
  const effective = manual.trim() || address || fallback;
  if (!treasury?.configured) return <Dormant what="Bridging" />;
  return (
    <>
      <Lead>
        Bridge pulls any USDC sitting in your Arc wallet into the Circle managed wallet, which then burns it through
        Circle CCTP on Arc and mints natively on Ethereum Sepolia. A real cross chain round trip — one click.
      </Lead>
      <ActionCard
        from="Your wallet + managed (Arc)"
        to="Ethereum Sepolia"
        available={bridgeable}
        cta="Bridge it"
        busyLabel="Bridging…"
        busy={bridging}
        disabled={busy}
        emptyHint="Nothing to bridge. Withdraw your earnings to your wallet first."
        reserveNote={`${GAS_RESERVE} USDC stays behind for Arc gas.`}
        onRun={(amount) => void bridgeToSepolia(amount, effective)}
        footer="CCTP charges nothing on a standard transfer. You pay a little Arc gas in USDC on the burn, plus a little Sepolia ETH on the mint. Settlement takes a few minutes while Circle attests."
      >
        <RecipientField label="Lands at (on Sepolia)" manual={manual} setManual={setManual} fallback={fallback} />
        <div className="mt-4 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/40 px-3 py-2.5 text-[11px] text-[var(--muted)]">
          <Row label="Route" value="Arc → Ethereum Sepolia" mono />
          <Row label="Lands at">
            <Addr value={effective} />
          </Row>
          <Row label="Cost" value="CCTP fee 0 · gas only" />
        </div>
      </ActionCard>
    </>
  );
}

function SendBody() {
  const { creatorBalances, treasury, config, treasuryPayout, payingOut, busy } = useDemo();
  const { address } = useAccount();
  const [manual, setManual] = useState("");
  const treasuryUsdc = treasury?.configured ? Number(treasury.usdc) : 0;
  const walletUsdc = Number(creatorBalances?.wallet.formatted ?? 0);
  // Send tops the managed wallet up from your Arc wallet first (the folded-in deposit), then pays out.
  const sendable = treasuryUsdc + Math.max(0, walletUsdc - GAS_RESERVE);
  const fallback = config?.addresses.creator ?? "";
  const effective = manual.trim() || address || fallback;
  if (!treasury?.configured) return <Dormant what="Sending" />;
  return (
    <>
      <Lead>
        Pulls any USDC from your Arc wallet into the managed wallet, then pays it straight out to any address on Arc,
        signed by Circle through the Console API. Connect a wallet to send to yourself, or type any address.
      </Lead>
      <ActionCard
        from="Your wallet + managed (Arc)"
        to="Any Arc address"
        available={sendable}
        cta="Send it"
        busyLabel="Sending…"
        busy={payingOut}
        disabled={busy}
        emptyHint="Nothing to send. Withdraw your earnings to your wallet first."
        onRun={(amount) => void treasuryPayout(amount, effective)}
      >
        <RecipientField label="Send to" manual={manual} setManual={setManual} fallback={fallback} />
      </ActionCard>
    </>
  );
}

function Row({ label, value, children, mono }: { label: string; value?: string; children?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span>{label}</span>
      {children ?? <span className={`text-[var(--foreground)] ${mono ? "font-mono" : ""}`}>{value}</span>}
    </div>
  );
}
