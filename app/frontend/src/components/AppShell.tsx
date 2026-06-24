"use client";

import { DemoProvider, useDemo } from "./demo-store";
import { TopNav } from "./TopNav";
import { EventLogDock } from "./EventLogDock";

// One provider + nav for every route. DemoProvider lives here (not on a page) so balances, receipts
// and the event log stay live as you move between pages, and the poll keeps running throughout.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <div className="flex min-h-full flex-col">
        <TopNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
        <footer className="mt-8 border-t border-[var(--border-color)] py-6 text-center text-[11px] text-[var(--muted)]">
          Live on Arc testnet · contracts source verified on Arcscan · built for the Circle Arc Builders Fund
        </footer>
      </div>
      <DockGate />
    </DemoProvider>
  );
}

// Only float the activity dock once something has actually happened, so the landing page stays clean.
function DockGate() {
  const { log } = useDemo();
  if (log.length === 0) return null;
  return <EventLogDock />;
}
