"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, type AttestResponse, type Balances, type BackendConfig, type Receipt } from "@/lib/api";
import { CONTRACTS, PROOF_OF_VIEW_ABI, publicClient } from "@/lib/chain";

export type LogKind = "info" | "attest" | "pay" | "good" | "bad";
export type LogEntry = { id: number; at: string; kind: LogKind; text: string };

type DemoState = {
  backendUp: boolean | null;
  config: BackendConfig | null;
  balances: Balances | null;
  receipts: Receipt[];
  lastProof: AttestResponse | null;
  onchainAttestor: string | null;
  attestorTrusted: boolean | null;
  log: LogEntry[];
  campaignId: number;
  busy: boolean;
  setCampaignId: (id: number) => void;
  watchAndPay: (viewerSecret: string) => Promise<void>;
  replayLast: () => Promise<void>;
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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [lastProof, setLastProof] = useState<AttestResponse | null>(null);
  const [onchainAttestor, setOnchainAttestor] = useState<string | null>(null);
  const [attestorTrusted, setAttestorTrusted] = useState<boolean | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [campaignId, setCampaignId] = useState(1);
  const [busy, setBusy] = useState(false);
  const logId = useRef(0);

  const push = useCallback((kind: LogKind, text: string) => {
    setLog((l) => [{ id: ++logId.current, at: new Date().toLocaleTimeString(), kind, text }, ...l].slice(0, 60));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([api.balances(), api.receipts()]);
      setBalances(b);
      setReceipts(r.receipts);
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
          push("bad", "Backend not reachable on :8787. Run `pnpm dev` in app/backend.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [push, refresh]);

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
        push("good", `Nanopayment settled ✓ ${res.receipt.formattedAmount} USDC · tx ${res.receipt.transaction.slice(0, 8)}…`);
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

  return (
    <Ctx.Provider
      value={{
        backendUp,
        config,
        balances,
        receipts,
        lastProof,
        onchainAttestor,
        attestorTrusted,
        log,
        campaignId,
        busy,
        setCampaignId,
        watchAndPay,
        replayLast,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
