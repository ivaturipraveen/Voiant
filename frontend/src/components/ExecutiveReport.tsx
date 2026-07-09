import { useEffect, useState } from "react";
import {
  api,
  fmtMoney,
  type ClientConfig,
  type ExecMetric,
  type ExecutiveSummaryResponse,
  type Finding,
  type Health,
} from "../api";
import { Sparkline, spark } from "./Shared";

const QUOTA_CODES = ["DEPLOYED", "PAINTBRUSH", "REP_OVERLOADED", "FAIRNESS", "TARGET"];

type ToneKey = "neutral" | "good" | "warn" | "danger";

const TONE_COLOR: Record<ToneKey, string> = {
  neutral: "#64748B",
  good: "#22C55E",
  warn: "#B7791F",
  danger: "#EF4444",
};

const TONE_TEXT: Record<ToneKey, string> = {
  neutral: "text-navy",
  good: "text-band-equitable",
  warn: "text-flag-text",
  danger: "text-band-overloaded",
};

// Split "$34.0M (25.8%)" -> { main: "$34.0M", pill: "25.8%" }
function splitValue(value: string): { main: string; pill?: string } {
  const m = value.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { main: m[1].trim(), pill: m[2].trim() };
  return { main: value };
}

function tone(m: ExecMetric): ToneKey {
  return (["neutral", "good", "warn", "danger"].includes(m.tone) ? m.tone : "neutral") as ToneKey;
}

// A single headline metric tile with a decorative sparkline and trend pill.
function MetricTile({ label, metric, caption }: { label: string; metric?: ExecMetric; caption: string }) {
  if (!metric) return null;
  const t = tone(metric);
  const { main, pill } = splitValue(metric.value);
  const dir = t === "good" ? "up" : t === "danger" || t === "warn" ? "down" : "flat";
  const flagged = t === "danger" || t === "warn";
  return (
    <div
      className={`flex-1 basis-[210px] rounded-xl border px-4 py-3.5 ${
        flagged ? "border-flag-border bg-flag-bg" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</span>
        {pill && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              t === "good" ? "bg-emerald-100 text-emerald-700" : t === "danger" ? "bg-red-100 text-red-700" : "bg-flag-text/15 text-flag-text"
            }`}
          >
            {dir === "up" ? "▲" : dir === "down" ? "▼" : ""} {pill}
          </span>
        )}
      </div>
      <div className={`mt-1.5 font-display text-[26px] font-extrabold leading-none tracking-tight tabular-nums ${TONE_TEXT[t]}`}>
        {main}
      </div>
      <div className="mt-2">
        <Sparkline data={spark(label, dir)} color={TONE_COLOR[t]} className="h-6 w-full opacity-70" />
      </div>
      <div className="mt-1.5 text-[10.5px] uppercase tracking-wide text-slate-400">{caption}</div>
    </div>
  );
}

function fallbackSourceAgent(f: Finding): string {
  if (QUOTA_CODES.some((c) => f.code.includes(c))) return "Quota Equity";
  if (f.code.includes("HEADROOM") || f.code.includes("REPS_") || f.code.includes("REDISTRIB"))
    return "Capacity Headroom";
  if (f.code.includes("STAGE") || f.code.includes("PIPELINE")) return "Pipeline Hygiene";
  return "Platform";
}

function confidenceDisplay(conf: string): { label: string; cls: string; dir: "up" | "down" } {
  const c = conf.toLowerCase();
  if (c === "high") return { label: "High", cls: "text-red-600", dir: "up" };
  if (c === "med") return { label: "Medium", cls: "text-navy", dir: "up" };
  return { label: "Low", cls: "text-slate-500", dir: "down" };
}

function fallbackConfidence(sev: string): { label: string; cls: string; dir: "up" | "down" } {
  if (sev === "critical") return { label: "High", cls: "text-red-600", dir: "up" };
  if (sev === "warn") return { label: "High", cls: "text-navy", dir: "up" };
  return { label: "Medium", cls: "text-slate-500", dir: "down" };
}

function fallbackImpact(f: Finding): string {
  let best: number | null = null;
  for (const v of Object.values(f.evidence ?? {})) {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!isNaN(n) && n >= 1000 && (best == null || n > best)) best = n;
  }
  return best == null ? "—" : fmtMoney(best);
}

function findingTrend(f: Finding): number[] {
  if (f.trend_6w && f.trend_6w.length >= 2) return f.trend_6w;
  return spark(f.code, f.severity === "critical" ? "up" : "down");
}

function trendSparkColor(f: Finding, trend: number[]): string {
  if (f.severity === "critical") return "#B7791F";
  const rising = trend[trend.length - 1] >= trend[0];
  return rising ? "#B7791F" : "#94A3B8";
}

function ruleColClasses(i: number): string {
  const col = i % 3;
  const smCol = i % 2;
  const c = ["text-[12.5px] leading-relaxed text-slate-500"];
  if (smCol === 0) c.push("sm:pr-6");
  if (smCol === 1) {
    c.push("sm:border-l sm:border-slate-200 sm:pl-6");
    // Reset tablet divider only when this cell is the first lg column (e.g. row 2, col 1)
    if (col === 0) c.push("lg:border-l-0 lg:pl-0");
  }
  if (col === 0) c.push("lg:pr-6");
  if (col === 1) c.push("lg:border-l lg:border-slate-200 lg:px-6");
  if (col === 2) c.push("lg:border-l lg:border-slate-200 lg:pl-6");
  return c.join(" ");
}

// Executive Summary rendered as the report's opening section
export default function ExecutiveReport({
  data,
  health,
}: {
  data: ExecutiveSummaryResponse;
  health: Health | null;
}) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig(null));
  }, []);

  const byLabel = (needle: string) =>
    data.metrics.find((m) => m.label.toLowerCase().includes(needle.toLowerCase()));

  const target = byLabel("top-down target");
  const deployed = byLabel("deployed");
  const over = byLabel("over-assignment");
  const headroom = byLabel("additional capacity");
  const overloaded = byLabel("overloaded");

  const now = new Date();
  const fy = `FY${String(now.getFullYear()).slice(2)}`;
  const rawName = health?.client.name ?? config?.company.name ?? "Client";
  const clientName = rawName.replace(/\s*\(sample\)\s*/i, "").trim() || rawName;

  const headline = data.top_findings[0];
  const overPct = headline?.evidence?.over_assignment_pct
    ? Math.round(Number(headline.evidence.over_assignment_pct))
    : undefined;
  const headroomMain = headroom ? splitValue(headroom.value).main : null;

  const rules = config?.interpretation_rules ?? [];

  return (
    <div className="space-y-8 pb-4">
      {/* Headline finding + reclaimable headroom callout */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[2.3fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Headline Finding
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">01 / 03</span>
          </div>
          <h2 className="mt-3 font-display text-[22px] font-semibold leading-snug tracking-tight text-navy">
            Deployed quota exceeds the {fy} top-down target{overPct != null ? ` by ${overPct}%` : ""}, masking material
            capacity that could be reclaimed through targeted redistribution.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
            {headline?.message} {data.narrative}
          </p>
        </div>

        <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#33518f] to-[#3f5fa1] p-6 text-white">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Reclaimable Headroom
            </div>
            <div className="mt-4 font-display text-[44px] font-extrabold leading-none tracking-tight text-white">
              {headroomMain ?? "—"}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
              If redistributed to the fair band.
            </p>
          </div>
          <p className="mt-auto pt-8 text-[11.5px] leading-relaxed text-white/45">
            Modeled at quota level from per-rep pipeline coverage. Full redistribution scenarios available in Capacity
            Analysis.
          </p>
        </div>
      </section>

      {/* Metric strip */}
      <section className="flex flex-wrap gap-3">
        <MetricTile label={`${fy} Target`} metric={target} caption="Top-down · company plan" />
        <MetricTile label="Deployed Quota" metric={deployed} caption="Sum of rep quotas" />
        <MetricTile label="Over-Assignment" metric={over} caption="Cushion vs target" />
        <MetricTile label="Overloaded Reps" metric={overloaded} caption="Above sustainable ceiling" />
      </section>

      {/* Findings this period */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 01.2</span>
            Findings This Period
          </h3>
          <span className="text-[11px] text-slate-400">Ranked by expected impact</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <th className="w-10 py-2.5 pl-4 pr-2 font-semibold">#</th>
                <th className="py-2.5 pr-4 font-semibold">Finding</th>
                <th className="whitespace-nowrap py-2.5 pr-4 font-semibold">Source Agent</th>
                <th className="whitespace-nowrap py-2.5 pr-4 font-semibold">Confidence</th>
                <th className="whitespace-nowrap py-2.5 pr-4 font-semibold">6-Wk Trend</th>
                <th className="whitespace-nowrap py-2.5 pr-4 text-right font-semibold">Impact</th>
              </tr>
            </thead>
            <tbody>
              {data.top_findings.map((f, i) => {
                const c = f.confidence ? confidenceDisplay(f.confidence) : fallbackConfidence(f.severity);
                const trend = findingTrend(f);
                return (
                  <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-3.5 pl-4 pr-2 font-mono text-slate-300">{i + 1}</td>
                    <td className="py-3.5 pr-4">
                      <div className="font-medium text-navy">{f.message}</div>
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-slate-500">
                      {f.source_agent ?? fallbackSourceAgent(f)}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${c.cls}`}>
                        {c.dir === "up" ? "▲" : "▼"} {c.label}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Sparkline
                        data={trend}
                        color={trendSparkColor(f, trend)}
                        className="h-6 w-24"
                      />
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-right font-semibold tabular-nums text-navy">
                      {f.impact_label ?? fallbackImpact(f)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Basis of analysis — the client ruleset that governed this run */}
      {rules.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
              <span className="mr-2 font-mono text-[12px] text-slate-400">§ 01.3</span>
              Basis of Analysis
            </h3>
            <span className="text-[11px] text-slate-400">
              {clientName}-specific interpretation rules currently applied
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between border-b border-slate-100 pb-3">
              <span className="font-display text-[13.5px] font-bold text-navy">
                {clientName} · {fy} Ruleset
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {rules.length} rules · v{config?.version ?? 1}
              </span>
            </div>
            <div className="grid gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {rules.slice(0, 6).map((r, i) => (
                <div key={r.id} className={ruleColClasses(i)}>
                  <span className="font-semibold text-navy">§ {r.label}.</span> {r.rule}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
