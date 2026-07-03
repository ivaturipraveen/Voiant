import { type ReactNode, useState } from "react";
import type { Finding } from "../api";
import Markdown from "./Markdown";

const SEV: Record<string, string> = {
  critical: "border-band-overloaded bg-red-50 text-red-700",
  warn: "border-band-stretched bg-amber-50 text-amber-700",
  info: "border-slate-300 bg-slate-50 text-slate-600",
};

// A small, monochrome initials chip for a rep — quiet visual anchor for people/demographic
// rows. Works with masked names too (initials from "L. R.", a dot for a fully-redacted name).
export function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter((c) => c && /[A-Za-z0-9]/.test(c))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "•";
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 font-display text-[10px] font-semibold text-slatebody ring-1 ring-inset ring-slate-200">
      {initials}
    </span>
  );
}

// A section heading with a short "what this is / how to read it" description.
export function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-3">
      <div className="panel-title">{title}</div>
      {desc && <p className="mt-1 text-[11px] leading-snug text-slatebody">{desc}</p>}
    </div>
  );
}

export function FindingsCard({ findings, initial = 6 }: { findings: Finding[]; initial?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? findings : findings.slice(0, initial);
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="panel-title">Findings ({findings.length})</div>
          <p className="mt-1 text-[11px] leading-snug text-slatebody">
            Everything the agent flagged, most severe first (critical → info). Each shows the exact
            numbers behind it.
          </p>
        </div>
        {findings.length > initial && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-[11px] font-semibold text-brand-dark hover:underline"
          >
            {expanded ? "Show fewer" : `Show all ${findings.length}`}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {shown.map((f, i) => (
          <div key={i} className={`rounded-lg border-l-4 px-3 py-2 text-sm ${SEV[f.severity] ?? SEV.info}`}>
            <span className="mr-2 font-mono text-[10px] uppercase opacity-70">{f.code}</span>
            {f.message}
          </div>
        ))}
      </div>
      {!expanded && findings.length > initial && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs text-slatebody hover:border-brand hover:text-brand-dark"
        >
          + {findings.length - initial} more findings
        </button>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "danger" | "good";
}) {
  const color =
    tone === "danger"
      ? "text-band-overloaded"
      : tone === "good"
      ? "text-band-equitable"
      : tone === "accent"
      ? "text-brand-dark"
      : "text-navy";
  return (
    <div className="stat-tile flex-1 basis-[150px]">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slatebody">{label}</div>
      <div className={`mt-1 metric-value ${color}`}>{value}</div>
    </div>
  );
}

export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}

export function NarrativeCard({
  narrative,
  source,
  hash,
}: {
  narrative: string;
  source: string;
  hash: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="panel-title">Reasoning Narrative</div>
          <p className="mt-1 text-[11px] leading-snug text-slatebody">
            Plain-English explanation of the numbers above — written by Claude, which only phrases the
            computed figures (never invents them). Falls back to a deterministic write-up if the AI is off.
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-slatebody">
          via {source} · hash {hash.slice(0, 10)}
        </span>
      </div>
      <Markdown source={narrative} />
    </div>
  );
}
