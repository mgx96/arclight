"use client";

import { useState } from "react";
import { useDemo, type LogKind } from "./demo-store";

const dot: Record<LogKind, string> = {
  info: "bg-[var(--muted)]",
  attest: "bg-sky-400",
  pay: "bg-[var(--accent)]",
  good: "bg-[var(--good)]",
  bad: "bg-[var(--bad)]",
};

// A floating activity log so you always see what just happened (paid, withdrew, bridged, failed)
// no matter which page you are on. Collapsible so it never gets in the way.
export function EventLogDock() {
  const { log } = useDemo();
  const [open, setOpen] = useState(true);
  const latest = log[0];

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,380px)]">
      <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--background)]/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${latest ? dot[latest.kind] : "bg-[var(--muted)]"}`} />
          <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Activity</span>
          {!open && latest && (
            <span className="ml-1 truncate text-[11px] text-[var(--foreground)]">{latest.text}</span>
          )}
          <span className="ml-auto text-[var(--muted)]">{open ? "▾" : "▴"}</span>
        </button>
        {open && (
          <div className="scroll-slim max-h-56 space-y-1 overflow-y-auto border-t border-[var(--border-color)] px-3 py-2 font-mono text-[11px]">
            {log.map((e) => (
              <div key={e.id} className="flex items-start gap-2">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dot[e.kind]}`} />
                <span className="shrink-0 text-[var(--muted)]">{e.at}</span>
                <span className="text-[var(--foreground)]">
                  {e.text}
                  {e.link && (
                    <>
                      {" "}
                      <a
                        href={e.link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-soft)] underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
                      >
                        {e.link.label} ↗
                      </a>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
