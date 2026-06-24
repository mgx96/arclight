"use client";

import Link from "next/link";

export function PageHeader({
  title,
  lead,
  back,
  accent,
}: {
  title: string;
  lead?: string;
  back?: { href: string; label: string };
  accent?: string;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← {back.label}
        </Link>
      )}
      {accent && <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{accent}</div>}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
      {lead && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{lead}</p>}
    </div>
  );
}
