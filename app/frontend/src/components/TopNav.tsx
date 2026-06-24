"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { WalletConnect } from "./WalletConnect";
import { useDemo } from "./demo-store";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/creator", label: "Transfers" },
  { href: "/history", label: "History" },
];

export function TopNav() {
  const pathname = usePathname();
  const { backendUp, attestorTrusted } = useDemo();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
        <Link href="/" className="leading-none" aria-label="Arclight home">
          <Wordmark size="text-2xl" glow beam />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] lg:inline-flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendUp === true ? "bg-[var(--good)]" : backendUp === false ? "bg-[var(--bad)]" : "bg-[var(--muted)]"
              }`}
            />
            {backendUp === true ? "live on Arc testnet" : backendUp === false ? "offline" : "connecting…"}
          </span>
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted)] lg:inline-flex">
            <span className={`h-1.5 w-1.5 rounded-full ${attestorTrusted ? "bg-[var(--good)]" : "bg-[var(--muted)]"}`} />
            {attestorTrusted ? "attestor verified" : "attestor checking…"}
          </span>
          <WalletConnect />
          <ThemeToggle />
        </div>
      </div>

      {/* mobile nav row */}
      <nav className="flex items-center gap-1 overflow-x-auto px-6 pb-2 md:hidden">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-[var(--surface-2)] text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
