"use client";

import { useState } from "react";
import { Button } from "./ui";

// A single money move on its own page: shows where it goes, lets you pick the amount (or take it all
// with ALL), and fires one action. `children` slots in extra fields like a recipient or a cost panel.
export function ActionCard({
  from,
  to,
  available,
  unit = "USDC",
  cta,
  busyLabel,
  busy,
  disabled,
  emptyHint,
  reserveNote,
  onRun,
  children,
  footer,
}: {
  from: string;
  to: string;
  available: number;
  unit?: string;
  cta: string;
  busyLabel: string;
  busy: boolean;
  disabled?: boolean;
  emptyHint: string;
  reserveNote?: string;
  onRun: (amount?: string) => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [amount, setAmount] = useState("");
  const maxStr = available > 0 ? trim(available) : "";
  const amountNum = amount === "" ? available : Number(amount);
  const overMax = amountNum > available + 1e-9;
  const empty = available <= 0;

  const run = () => {
    if (busy || disabled || empty) return;
    onRun(amount === "" ? undefined : amount);
  };

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/40 p-5">
      {/* route */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-md border border-[var(--border-color)] bg-[var(--surface-2)]/60 px-2.5 py-1 font-medium text-[var(--foreground)]">
          {from}
        </span>
        <span className="text-[var(--accent-soft)]">→</span>
        <span className="rounded-md border border-[var(--border-color)] bg-[var(--surface-2)]/60 px-2.5 py-1 font-medium text-[var(--foreground)]">
          {to}
        </span>
        <span className="ml-auto">
          available <span className="font-mono text-[var(--foreground)]">{available.toFixed(2)} {unit}</span>
        </span>
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{emptyHint}</p>
      ) : (
        <>
          {children}

          <div className="mt-4 flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]/40 px-3">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={maxStr}
                inputMode="decimal"
                className="h-10 w-full bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              />
              <span className="text-xs text-[var(--muted)]">{unit}</span>
              <button
                onClick={() => setAmount(maxStr)}
                className="ml-2 rounded-md border border-[var(--border-color)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-soft)] hover:bg-[var(--surface-2)]"
              >
                ALL
              </button>
            </div>
            <Button onClick={run} disabled={busy || disabled || overMax}>
              {busy ? busyLabel : cta}
            </Button>
          </div>

          {overMax && (
            <p className="mt-2 text-xs text-[var(--bad)]">
              That is more than the {available.toFixed(2)} {unit} available here.
            </p>
          )}
          {reserveNote && <p className="mt-2 text-xs text-[var(--muted)]">{reserveNote}</p>}
        </>
      )}

      {footer && <div className="mt-4 border-t border-[var(--border-color)] pt-4 text-xs leading-relaxed text-[var(--muted)]">{footer}</div>}
    </div>
  );
}

// Trim a balance to 6 decimals without trailing zero noise, so ALL fills a clean value.
function trim(n: number): string {
  return String(Math.floor(n * 1e6) / 1e6);
}
