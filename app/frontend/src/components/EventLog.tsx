"use client";

import { useDemo, type LogKind } from "./demo-store";

const dot: Record<LogKind, string> = {
  info: "bg-[var(--muted)]",
  attest: "bg-sky-400",
  pay: "bg-[var(--accent)]",
  good: "bg-[var(--good)]",
  bad: "bg-[var(--bad)]",
};

export function EventLog() {
  const { log } = useDemo();
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface)]/80 p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Live event log</h2>
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">attest → verify → settle</span>
      </div>
      <div className="scroll-slim max-h-56 space-y-1 overflow-y-auto pr-1 font-mono text-[11px]">
        {log.length === 0 && <div className="text-[var(--muted)]">waiting for activity…</div>}
        {log.map((e) => (
          <div key={e.id} className="flex items-start gap-2">
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot[e.kind]}`} />
            <span className="shrink-0 text-[var(--muted)]">{e.at}</span>
            <span className="text-[var(--foreground)]">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
