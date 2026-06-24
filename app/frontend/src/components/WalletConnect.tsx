"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";
import { useWalletBalance } from "@/lib/useWalletBalance";

// One Connect control for the whole app. Instead of auto-grabbing whatever wallet hijacked the page,
// it shows a small menu of the wallets the browser actually has, so you pick the one you want. When a
// wallet is connected, its address becomes the default place your money lands on Send and Bridge.
export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { usdc } = useWalletBalance();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        title="Click to disconnect"
        className="flex items-center gap-2 rounded-full border border-[var(--good)]/40 bg-[var(--good)]/10 px-3 py-1.5 text-xs font-medium text-[var(--good)] hover:bg-[var(--good)]/15"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
        {usdc != null && (
          <span className="font-semibold tabular-nums">{usdc.toFixed(2)} USDC</span>
        )}
        <span className="font-mono opacity-80">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      </button>
    );
  }

  // De-dupe connectors by display name (EIP-6963 discovery can surface the same wallet twice).
  const seen = new Set<string>();
  const wallets = connectors.filter((c) => {
    const key = c.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-black shadow-[0_8px_24px_-10px_var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--background)]/95 p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--muted)]">Choose a wallet</div>
          {wallets.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--muted)]">No wallet detected in this browser.</div>
          )}
          {wallets.map((c) => (
            <WalletRow
              key={c.uid}
              connector={c}
              onPick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletRow({ connector, onPick }: { connector: Connector; onPick: () => void }) {
  const icon = (connector as { icon?: string }).icon;
  return (
    <button
      onClick={onPick}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--surface-2)]"
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="h-5 w-5 rounded" />
      ) : (
        <span className="grid h-5 w-5 place-items-center rounded bg-[var(--surface-2)] text-[10px] text-[var(--muted)]">
          {connector.name.slice(0, 1)}
        </span>
      )}
      <span>{connector.name}</span>
    </button>
  );
}
