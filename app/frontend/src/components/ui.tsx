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
      className={`rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/40 p-6 transition-colors hover:border-[var(--accent)]/20 ${className}`}
    >
      <header className="mb-5">
        {accent && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{accent}</div>
        )}
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-[var(--foreground)]">{title}</h2>
        {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="border-l border-[var(--border-color)] pl-3">
      <div className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
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
      "bg-[var(--accent)] text-black shadow-[0_8px_24px_-10px_var(--accent)] hover:bg-[var(--accent-soft)] disabled:bg-[var(--surface-2)] disabled:text-[var(--muted)] disabled:shadow-none",
    ghost:
      "border border-[var(--border-color)] text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:text-[var(--muted)]",
    danger:
      "border border-[var(--bad)]/40 text-[var(--bad)] hover:bg-[var(--bad)]/10 disabled:opacity-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
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
