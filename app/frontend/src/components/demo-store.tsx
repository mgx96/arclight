"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  type AttestResponse,
  type Balances,
  type BackendConfig,
  type CreatorBalances,
  type Receipt,
  type Treasury,
} from "@/lib/api";
import { CONTRACTS, PROOF_OF_VIEW_ABI, publicClient, explorerTx, sepoliaTx } from "@/lib/chain";

export type LogKind = "info" | "attest" | "pay" | "good" | "bad";
export type LogLink = { label: string; url: string };
export type LogEntry = { id: number; at: string; kind: LogKind; text: string; link?: LogLink };

// Structured, persisted record of every money move the user makes from the Transfers widget, so the
// History tab can show what button was pressed, how much, when, and a click-through to the explorer.
export type PayoutAction = "withdraw" | "move" | "bridge" | "send";
export type PayoutLink = { label: string; url: string };
export type PayoutRecord = {
  id: string;
  action: PayoutAction;
  amount: string;
  status: string;
  at: number; // epoch ms
  links: PayoutLink[];
};

const PAYOUTS_KEY = "arclight.payouts";

type DemoState = {
  backendUp: boolean | null;
  config: BackendConfig | null;
  balances: Balances | null;
  creatorBalances: CreatorBalances | null;
  receipts: Receipt[];
  treasury: Treasury | null;
  lastProof: AttestResponse | null;
  onchainAttestor: string | null;
  attestorTrusted: boolean | null;
  log: LogEntry[];
  payouts: PayoutRecord[];
  campaignId: number;
  busy: boolean;
  withdrawing: boolean;
  sweeping: boolean;
  payingOut: boolean;
  bridging: boolean;
  setCampaignId: (id: number) => void;
  watchAndPay: (viewerSecret: string) => Promise<void>;
  replayLast: () => Promise<void>;
  withdrawCreator: (amount?: string, recipient?: string) => Promise<void>;
  sweepToTreasury: (amount?: string) => Promise<void>;
  treasuryPayout: (amount?: string, destination?: string) => Promise<void>;
  bridgeToSepolia: (amount?: string, recipient?: string) => Promise<void>;
  clearPayouts: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<DemoState | null>(null);

export function useDemo(): DemoState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [backendUp, setBackendUp] = useState<boolean | null>(null);
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [creatorBalances, setCreatorBalances] = useState<CreatorBalances | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [lastProof, setLastProof] = useState<AttestResponse | null>(null);
  const [onchainAttestor, setOnchainAttestor] = useState<string | null>(null);
  const [attestorTrusted, setAttestorTrusted] = useState<boolean | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [campaignId, setCampaignId] = useState(1);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [bridging, setBridging] = useState(false);
  const logId = useRef(0);

  const push = useCallback((kind: LogKind, text: string, link?: LogLink) => {
    setLog((l) => [{ id: ++logId.current, at: new Date().toLocaleTimeString(), kind, text, link }, ...l].slice(0, 60));
  }, []);

  // Rehydrate the payout history from localStorage once, after mount. Loading post-mount (rather than in
  // a lazy useState initializer) is intentional: it keeps the server and first client render identical
  // (both empty) so there's no hydration mismatch, then fills in from the external store. That makes the
  // synchronous setState here the correct pattern, not the perf footgun the lint rule guards against.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAYOUTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing an external store after mount
      if (raw) setPayouts(JSON.parse(raw) as PayoutRecord[]);
    } catch {
      /* corrupt/absent — start fresh */
    }
  }, []);

  const recordPayout = useCallback(
    (action: PayoutAction, amount: string, status: string, links: PayoutLink[]) => {
      setPayouts((p) => {
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        const next = [{ id, action, amount, status, links, at: Date.now() }, ...p].slice(0, 100);
        try {
          localStorage.setItem(PAYOUTS_KEY, JSON.stringify(next));
        } catch {
          /* storage full/blocked — keep in-memory */
        }
        return next;
      });
    },
    []
  );

  const clearPayouts = useCallback(() => {
    setPayouts([]);
    try {
      localStorage.removeItem(PAYOUTS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [b, cb, r, t] = await Promise.all([
        api.balances(),
        api.creatorBalances(),
        api.receipts(),
        api.treasury(),
      ]);
      setBalances(b);
      setCreatorBalances(cb);
      setReceipts(r.receipts);
      setTreasury(t);
    } catch {
      /* surfaced elsewhere */
    }
  }, []);

  // Boot: confirm backend, load config, read the on-chain attestor and compare to the signer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.health();
        if (cancelled) return;
        setBackendUp(true);
        const cfg = await api.config();
        if (cancelled) return;
        setConfig(cfg);
        push("info", `Backend live · agent ${cfg.addresses.agent.slice(0, 8)}… · price ${cfg.viewPrice} per view`);

        await refresh();

        try {
          const onchain = (await publicClient.readContract({
            address: CONTRACTS.ProofOfView,
            abi: PROOF_OF_VIEW_ABI,
            functionName: "getAttestor",
          })) as string;
          if (cancelled) return;
          setOnchainAttestor(onchain);
          const trusted = onchain.toLowerCase() === cfg.addresses.attestor.toLowerCase();
          setAttestorTrusted(trusted);
          push(trusted ? "good" : "bad", trusted
            ? `Onchain ProofOfView trusts this attestor ✓`
            : `Warning: onchain attestor ${onchain.slice(0, 8)}… ≠ signer`);
        } catch {
          if (!cancelled) push("bad", "Could not read onchain attestor (RPC).");
        }
      } catch {
        if (!cancelled) {
          setBackendUp(false);
          push("bad", "Can't reach the settlement service right now. Retrying shortly.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [push, refresh]);

  // Circle batches sub-cent x402 payments, so a creator's Gateway credit lands minutes after the
  // view as a lump — not per click. Poll so that delayed credit shows up on its own instead of
  // looking stuck until the next user action.
  useEffect(() => {
    if (!backendUp) return;
    const id = setInterval(() => void refresh(), 12_000);
    return () => clearInterval(id);
  }, [backendUp, refresh]);

  const watchAndPay = useCallback(
    async (viewerSecret: string) => {
      if (!config) return;
      setBusy(true);
      try {
        push("attest", `Metering genuine view for viewer ${viewerSecret} …`);
        const proof = await api.attest({
          advertiser: config.addresses.agent,
          creator: config.addresses.creator,
          campaignId,
          weight: 1,
          viewerSecret,
        });
        setLastProof(proof);
        push("attest", `Attestation signed · nullifier ${proof.attestation.nullifier.slice(0, 10)}…`);

        push("pay", `Agent paying creator ${config.viewPrice} via Circle Gateway …`);
        const res = await api.payView({ attestation: proof.attestation, signature: proof.signature });
        push("good", `Paid ${res.receipt.formattedAmount} USDC via Gateway ✓ · transfer ${res.receipt.transaction.slice(0, 8)}…`);
        push("info", `Circle is batching this nanopayment — it settles to the creator's wallet shortly.`);
        await refresh();
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : String(e);
        push("bad", `Payment failed: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [config, campaignId, push, refresh]
  );

  const replayLast = useCallback(async () => {
    if (!lastProof) return;
    setBusy(true);
    try {
      push("pay", `Replaying the SAME proof (double spend attempt) …`);
      await api.payView({ attestation: lastProof.attestation, signature: lastProof.signature });
      push("bad", `Unexpected: replay was accepted.`);
      await refresh();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 409) push("good", `Blocked ✓ nullifier already consumed, sybil and double pay prevented.`);
      else push("bad", `Replay error: ${e instanceof ApiError ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [lastProof, push, refresh]);

  const withdrawCreator = useCallback(async (amount?: string, recipient?: string) => {
    setWithdrawing(true);
    try {
      const available = Number(creatorBalances?.gateway.available ?? 0);
      if (!(available > 0)) {
        push("info", "Nothing to withdraw yet. Your earnings are still building up in the Gateway balance.");
        return;
      }
      if (!recipient) {
        push("info", "Connect a wallet first — Withdraw settles your Gateway balance straight into it.");
        return;
      }
      const moving = amount ? Number(amount) : available;
      push("pay", `Withdrawing ${moving.toFixed(2)} USDC from your Gateway balance into your wallet …`);
      const res = await api.creatorWithdraw(amount, recipient);
      push("good", `Landed in your wallet ✓ ${res.amount} USDC`, { label: "View on Arcscan", url: explorerTx(res.mintTxHash) });
      recordPayout("withdraw", res.amount, "Settled", [{ label: "Arcscan ↗", url: explorerTx(res.mintTxHash) }]);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      push("bad", `Withdraw failed: ${msg}`);
    } finally {
      setWithdrawing(false);
    }
  }, [creatorBalances, push, refresh, recordPayout]);

  // Move the creator's on-chain earnings into the Circle Programmable Wallet (Developer-Controlled)
  // treasury — a real native-USDC transfer on Arc from the creator EOA to the Circle-managed address.
  const sweepToTreasury = useCallback(async (amount?: string) => {
    setSweeping(true);
    try {
      push("pay", "Depositing USDC from your wallet into your managed Circle wallet …");
      const res = await api.sweepToTreasury(amount);
      push("good", `Deposited ${res.amount} USDC into your managed wallet ✓`, { label: "View on Arcscan", url: explorerTx(res.txHash) });
      recordPayout("move", res.amount, "Settled", [{ label: "Arcscan ↗", url: explorerTx(res.txHash) }]);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      push("bad", `Move failed: ${msg}`);
    } finally {
      setSweeping(false);
    }
  }, [push, refresh, recordPayout]);

  // Pay out of the Circle treasury via Circle's Console-signed createTransaction API — the part that
  // exercises the CIRCLE_API_KEY + entity-secret credentials end-to-end.
  const treasuryPayout = useCallback(async (amount?: string, destination?: string) => {
    setPayingOut(true);
    try {
      push("pay", "Sending USDC out of your managed Circle wallet via the Console API …");
      const res = await api.treasuryPayout({ amount, destination });
      push(
        "good",
        `Sent ${res.amount} USDC to ${res.destination.slice(0, 8)}… ✓ ${res.state}`,
        res.txHash ? { label: "View on Arcscan", url: explorerTx(res.txHash) } : undefined
      );
      recordPayout("send", res.amount, res.state, res.txHash ? [{ label: "Arcscan ↗", url: explorerTx(res.txHash) }] : []);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      push("bad", `Send failed: ${msg}`);
    } finally {
      setPayingOut(false);
    }
  }, [push, refresh, recordPayout]);

  // Bridge USDC out of the managed Circle wallet to Ethereum Sepolia via CCTP — burn on Arc, Circle
  // attestation, mint on Sepolia. Runs server-side and can take a few minutes (standard CCTP transfer).
  const bridgeToSepolia = useCallback(async (amount?: string, recipient?: string) => {
    setBridging(true);
    try {
      push("pay", "Bridging USDC from Arc to Ethereum Sepolia via Circle CCTP (burn, attest, mint)…");
      push("info", "This is a standard CCTP transfer, so Circle's attestation can take a few minutes.");
      const res = await api.bridge({ amount, recipient });
      push("good", `Burned on Arc ✓`, { label: "View burn on Arcscan", url: explorerTx(res.burnTxHash) });
      push("good", `Minted on ${res.destinationChain} ✓ ${res.amount} USDC`, { label: "View mint on Etherscan", url: sepoliaTx(res.mintTxHash) });
      recordPayout("bridge", res.amount, `Minted on ${res.destinationChain}`, [
        { label: "Burn ↗ Arc", url: explorerTx(res.burnTxHash) },
        { label: "Mint ↗ Sepolia", url: sepoliaTx(res.mintTxHash) },
      ]);
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e);
      push("bad", `Bridge failed: ${msg}`);
    } finally {
      setBridging(false);
    }
  }, [push, refresh, recordPayout]);

  return (
    <Ctx.Provider
      value={{
        backendUp,
        config,
        balances,
        creatorBalances,
        receipts,
        treasury,
        lastProof,
        onchainAttestor,
        attestorTrusted,
        log,
        payouts,
        campaignId,
        busy,
        withdrawing,
        sweeping,
        payingOut,
        bridging,
        setCampaignId,
        watchAndPay,
        replayLast,
        withdrawCreator,
        sweepToTreasury,
        treasuryPayout,
        bridgeToSepolia,
        clearPayouts,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
