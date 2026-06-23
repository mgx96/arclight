"use client";

import { explorerAddress } from "@/lib/chain";

export function Panel({
  title,
  subtitle,
  accent,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/80 backdrop-blur p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-[var(--foreground)]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
        </div>
        {accent && (
          <span className="shrink-0 rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] uppercase tracking-widest text-[var(--muted)]">
            {accent}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-widest text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--foreground)]">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function Addr({ value, label }: { value?: string; label?: string }) {
  if (!value) return <span className="font-mono text-xs text-[var(--muted)]">—</span>;
  const short = `${value.slice(0, 6)}…${value.slice(-4)}`;
  return (
    <a
      href={explorerAddress(value)}
      target="_blank"
      rel="noreferrer"
      title={value}
      className="font-mono text-xs text-[var(--accent-soft)] hover:underline"
    >
      {label ? `${label} ` : ""}
      {short}
    </a>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-[var(--accent)] text-black hover:bg-[var(--accent-soft)] disabled:bg-[var(--surface-2)] disabled:text-[var(--muted)]",
    ghost:
      "border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:text-[var(--muted)]",
    danger:
      "border border-[var(--bad)]/40 text-[var(--bad)] hover:bg-[var(--bad)]/10 disabled:opacity-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({ tone = "muted", children }: { tone?: "good" | "bad" | "muted" | "accent"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    good: "border-[var(--good)]/40 text-[var(--good)] bg-[var(--good)]/10",
    bad: "border-[var(--bad)]/40 text-[var(--bad)] bg-[var(--bad)]/10",
    accent: "border-[var(--accent)]/40 text-[var(--accent-soft)] bg-[var(--accent)]/10",
    muted: "border-[var(--border-color)] text-[var(--muted)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono text-xs break-all text-[var(--muted)] ${className}`}>{children}</span>;
}
