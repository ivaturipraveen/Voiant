import { type ReactNode, useState } from "react";
import type { Finding } from "../api";
import Markdown from "./Markdown";

const SEV: Record<string, string> = {
  critical: "border-band-overloaded bg-red-50 text-red-700",
  warn: "border-band-stretched bg-amber-50 text-amber-700",
  info: "border-slate-300 bg-slate-50 text-slate-600",
};

// Shared Recharts tooltip styling — a clean card, consistent across every chart.
export const CHART_TOOLTIP = {
  borderRadius: 10,
  border: "1px solid #E2E7F1",
  boxShadow: "0 10px 30px -14px rgba(33,30,86,0.25)",
  fontSize: 12,
  padding: "6px 10px",
} as const;

// A small, monochrome initials chip for a rep — quiet visual anchor for people/demographic
// rows. Works with masked names too (initials from "L. R.", a dot for a fully-redacted name).
export function Avatar({ name, color }: { name: string; color?: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter((c) => c && /[A-Za-z0-9]/.test(c))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "•";

  if (color) {
    return (
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full font-display text-[10px] font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
    );
  }

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
  flagged = false,
  pill,
  sub,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "accent" | "danger" | "good" | "warn";
  flagged?: boolean; // cream background for a metric that needs attention
  pill?: string; // small badge next to the value (e.g. "+28% over")
  sub?: string; // caption under the number
}) {
  const text = {
    danger: "text-band-overloaded",
    good: "text-band-equitable",
    accent: "text-brand-dark",
    warn: "text-flag-text",
    neutral: "text-navy",
  }[tone];
  const surface = flagged ? "border-flag-border bg-flag-bg" : "border-slate-200 bg-white";
  return (
    <div
      className={`flex-1 basis-[180px] rounded-xl border ${surface} px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-150 hover:border-slate-300 hover:shadow-[0_6px_20px_-8px_rgba(16,24,40,0.12)]`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slatebody">{label}</span>
        {pill && (
          <span className="rounded bg-flag-text/15 px-1.5 py-0.5 text-[10px] font-bold text-flag-text">{pill}</span>
        )}
      </div>
      <div className={`mt-1.5 font-display text-[27px] font-extrabold leading-none tracking-tight tabular-nums ${text}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11px] leading-snug text-slatebody">{sub}</div>}
    </div>
  );
}

export function StatStrip({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}

// A tiny inline sparkline (decorative trend indicator). Points are drawn edge-to-edge.
export function Sparkline({
  data,
  color = "#94A3B8",
  className = "h-7 w-full",
  fill = false,
  showEndDot,
}: {
  data: number[];
  color?: string;
  className?: string;
  fill?: boolean;
  showEndDot?: boolean;
}) {
  const drawEndDot = showEndDot ?? !fill;
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - (drawEndDot ? 4 : 0));
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return { x, y };
  });
  const pts = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  const lastPt = points[points.length - 1];
  const prevPt = points[points.length - 2] || points[0];
  const dx = lastPt.x - prevPt.x;
  const dy = lastPt.y - prevPt.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      {fill && <polygon points={areaPts} fill={color} fillOpacity={0.08} />}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={fill ? "1.5" : "1.75"}
        strokeLinecap={drawEndDot ? "butt" : "round"}
        strokeLinejoin="round"
      />
      {drawEndDot && lastPt && (
        <g transform={`translate(${lastPt.x}, ${lastPt.y}) rotate(${angleDeg})`}>
          <path d="M 0,-3.5 A 3.5 3.5 0 0 0 0,3.5 Z" fill={color} />
        </g>
      )}
    </svg>
  );
}

// Deterministic gentle series from a string seed — stable across renders, so the
// decorative trend lines don't jitter. Direction nudges the drift up/down/flat.
export function spark(seed: string, dir: "up" | "down" | "flat" = "flat", n = 8): number[] {
  let s = 7;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) % 99991;
  const out: number[] = [];
  const base = 30 + (s % 18);
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s % 9) - 4;
    const drift = dir === "up" ? i * 3.2 : dir === "down" ? -i * 3.2 : Math.sin(i) * 2;
    out.push(base + drift + noise);
  }
  return out;
}

// Dashboard page header: big title + subtitle on the left, action buttons on the right.
export function PageHeader({ title, sub, actions }: { title: string; sub: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-navy">{title}</h1>
        <p className="mt-0.5 text-[13px] text-slatebody">{sub}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// Real Export action: downloads the current report as a JSON file (no dead buttons).
export function ExportButton({ data, filename }: { data: unknown; filename: string }) {
  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button className="btn-ghost py-1.5 text-[13px]" onClick={download}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
      </svg>
      Export
    </button>
  );
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
