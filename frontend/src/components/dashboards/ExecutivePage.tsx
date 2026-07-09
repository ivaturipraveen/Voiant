import { fmtMoney, type ExecutiveSummaryResponse, type Finding } from "../../api";
import { ExportButton, Metric, PageHeader, SectionHead, StatStrip } from "../Shared";

const QUOTA_CODES = ["DEPLOYED", "PAINTBRUSH", "REP_OVERLOADED", "FAIRNESS", "TARGET"];

// Static Executive Summary — every tile/row comes from the executive-summary endpoint.
export default function ExecutivePage({ data }: { data: ExecutiveSummaryResponse }) {
  const toneMap: Record<string, "neutral" | "accent" | "danger" | "good" | "warn"> = {
    good: "good",
    warn: "warn",
    danger: "danger",
    neutral: "neutral",
  };

  const actions = <ExportButton data={data} filename="executive-summary" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Executive Summary"
        sub="Top findings across territory, capacity, and pipeline health this week"
        actions={actions}
      />

      <StatStrip>
        {data.metrics.slice(0, 4).map((m) => (
          <Metric
            key={m.label}
            label={m.label}
            value={m.value}
            tone={toneMap[m.tone] ?? "neutral"}
            flagged={m.tone === "warn" || m.tone === "danger"}
          />
        ))}
        <Metric label="Findings This Week" value={String(data.top_findings.length)} sub="Ranked by impact" />
      </StatStrip>

      <div className="card p-4">
        <SectionHead
          title="Top findings"
          desc="Surfaced by the platform across all agents, most impactful first."
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slatebody">
                <th className="py-2 pr-3 font-semibold">#</th>
                <th className="py-2 pr-4 font-semibold">Finding</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Source agent</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Confidence</th>
                <th className="whitespace-nowrap py-2 text-right font-semibold">Impact</th>
              </tr>
            </thead>
            <tbody>
              {data.top_findings.map((f, i) => (
                <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                  <td className="py-3 pr-3 font-mono text-slate-400">{i + 1}</td>
                  <td className="py-3 pr-4 text-navy">{f.message}</td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <span className="inline-block whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slatebody">
                      {f.source_agent ?? sourceAgent(f)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <ConfidenceBadge confidence={f.confidence} severity={f.severity} />
                  </td>
                  <td className="whitespace-nowrap py-3 text-right font-semibold tabular-nums text-navy">
                    {f.impact_label ?? impact(f)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function sourceAgent(f: Finding): string {
  if (QUOTA_CODES.some((c) => f.code.includes(c))) return "Quota Equity";
  if (f.code.includes("HEADROOM") || f.code.includes("REPS_") || f.code.includes("REDISTRIB"))
    return "Capacity Headroom";
  return "Platform";
}

function ConfidenceBadge({ confidence, severity }: { confidence?: string; severity: string }) {
  const conf = confidence?.toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "High", cls: "bg-red-50 text-red-700" },
    med: { label: "Med", cls: "bg-amber-50 text-amber-700" },
    low: { label: "Low", cls: "bg-slate-100 text-slate-500" },
    critical: { label: "High", cls: "bg-red-50 text-red-700" },
    warn: { label: "Med", cls: "bg-amber-50 text-amber-700" },
    info: { label: "Low", cls: "bg-slate-100 text-slate-500" },
  };
  const b = (conf && map[conf]) ?? map[severity] ?? map.info;
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${b.cls}`}>{b.label}</span>;
}

// Pull the largest money-like value from the finding's evidence, else "—".
function impact(f: Finding): string {
  let best: number | null = null;
  for (const v of Object.values(f.evidence ?? {})) {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (!isNaN(n) && n >= 1000 && (best == null || n > best)) best = n;
  }
  return best == null ? "—" : fmtMoney(best);
}
