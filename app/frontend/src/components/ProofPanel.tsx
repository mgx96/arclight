"use client";

import { Panel, Addr, Pill, Mono } from "./ui";
import { useDemo } from "./demo-store";
import { CONTRACTS } from "@/lib/chain";

export function ProofPanel() {
  const { lastProof, onchainAttestor, attestorTrusted, config } = useDemo();
  const a = lastProof?.attestation;

  return (
    <Panel
      title="Proof of view"
      subtitle="Every payment needs a signed, single use attestation. That's the sybil resistance."
      accent="ProofOfView"
    >
      {/* trust chain */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Onchain ProofOfView trusts</span>
          {attestorTrusted == null ? (
            <Pill>checking…</Pill>
          ) : attestorTrusted ? (
            <Pill tone="good">verified ✓</Pill>
          ) : (
            <Pill tone="bad">mismatch</Pill>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--muted)]">attestor</span>
          <Addr value={onchainAttestor ?? config?.addresses.attestor} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--muted)]">oracle</span>
          <Addr value={CONTRACTS.ProofOfView} />
        </div>
      </div>

      {/* latest attestation */}
      <div className="mt-3">
        <div className="mb-1.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">Latest attestation</div>
        {!a ? (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] px-3 py-4 text-center text-xs text-[var(--muted)]">
            Play the video to mint the first proof.
          </div>
        ) : (
          <div className="space-y-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/40 px-3 py-2.5">
            <Field label="viewId" value={a.viewId} />
            <Field label="commitment" value={a.commitment} note="hides who the viewer is" />
            <Field label="nullifier" value={a.nullifier} note="one pay per viewer, campaign, epoch" />
            <div className="flex gap-4 pt-0.5 text-[11px] text-[var(--muted)]">
              <span>epoch <span className="font-mono text-[var(--foreground)]">{a.epoch}</span></span>
              <span>weight <span className="font-mono text-[var(--foreground)]">{a.weight}</span></span>
              <span>campaign <span className="font-mono text-[var(--foreground)]">#{a.campaignId}</span></span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-[var(--muted)]">
        The viewer only shows up as a hiding <span className="text-[var(--accent-soft)]">commitment</span>. The{" "}
        <span className="text-[var(--accent-soft)]">nullifier</span> caps it at one payout per viewer per campaign per
        epoch, so bots can&apos;t farm payouts and no viewer identity ever leaves the metering service.
      </p>
    </Panel>
  );
}

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[11px] text-[var(--muted)]">{label}</span>
      <div className="min-w-0 text-right">
        <Mono className="text-[var(--foreground)]">{value}</Mono>
        {note && <div className="text-[10px] text-[var(--muted)]">{note}</div>}
      </div>
    </div>
  );
}
