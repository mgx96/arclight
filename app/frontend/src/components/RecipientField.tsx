"use client";

import { useAccount } from "wagmi";
import { WalletConnect } from "./WalletConnect";

// Where the money lands. If you connect a wallet, its address is used automatically so you never
// paste anything. You can still type a different address to override it.
export function RecipientField({
  label,
  manual,
  setManual,
  fallback,
}: {
  label: string;
  manual: string;
  setManual: (v: string) => void;
  fallback: string;
}) {
  const { address, isConnected } = useAccount();
  const effective = manual.trim() || address || fallback;
  const usingConnected = !manual.trim() && isConnected && !!address;

  return (
    <div className="mt-1">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-[var(--muted)]">{label}</span>
        {isConnected ? (
          <span className="text-[11px] text-[var(--good)]">wallet connected</span>
        ) : (
          <WalletConnect />
        )}
      </div>

      <input
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder={address ?? fallback ?? "0x…"}
        className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/40 px-3 font-mono text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
      />

      <p className="mt-1.5 text-[11px] text-[var(--muted)]">
        {usingConnected
          ? "Going to your connected wallet."
          : manual.trim()
            ? "Going to the address you typed."
            : isConnected
              ? "Going to your connected wallet."
              : "Connect a wallet above, or type an address. For now it goes to your own creator wallet."}
        {" "}
        <span className="font-mono text-[var(--accent-soft)]">
          {effective ? `${effective.slice(0, 6)}…${effective.slice(-4)}` : "—"}
        </span>
      </p>
    </div>
  );
}
