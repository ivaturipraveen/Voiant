import { fmtMoney, type QuotaEquityReport } from "../../api";
import { ExportButton, FindingsCard, Metric, PageHeader, SectionHead, StatStrip } from "../Shared";

// Static Territory Equity dashboard, computed entirely from the report endpoint.
export default function TerritoryEquityPage({ report }: { report: QuotaEquityReport }) {
  const overPct = report.over_assignment_pct;
  const over = parseFloat(report.over_assignment) > 0;

  const segments = report.segments.map((s) => s.segment);
  const paintbrushed = new Set(report.segments.filter((s) => s.is_paintbrushed).map((s) => s.segment));
  const regions = Array.from(new Set(report.per_rep.map((r) => r.region)));

  // Cell = average fairness ratio for reps in (segment, region).
  const cell = (seg: string, reg: string) => {
    const rows = report.per_rep.filter((r) => r.segment === seg && r.region === reg);
    if (!rows.length) return null;
    return rows.reduce((a, r) => a + r.fairness_ratio, 0) / rows.length;
  };

  const fairnessFlags = report.per_rep.filter((r) => r.band !== "Equitable").length;

  const actions = <ExportButton data={report} filename="territory-equity" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Territory Equity"
        sub="Fairness of quota assignment across territories, segments, and regions"
        actions={actions}
      />

      {over && (
        <div className="flex gap-3 rounded-xl border border-flag-border bg-flag-bg p-4">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-flag-text/15 text-flag-text">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div>
            <div className="text-[14px] font-semibold text-navy">
              Deployed quota exceeds top-down target by {overPct.toFixed(0)}%
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-navy/75">
              Sum of individual rep quotas is <b>{fmtMoney(report.deployed_quota)}</b>, against the company target of{" "}
              <b>{fmtMoney(report.top_down_target)}</b>. This over-assignment cushion is common practice, but it means
              each rep is carrying more than their share of the actual target.
            </p>
          </div>
        </div>
      )}

      <StatStrip>
        <Metric label="Company Target" value={fmtMoney(report.top_down_target)} sub="Top-down plan" />
        <Metric
          label="Deployed Quota"
          value={fmtMoney(report.deployed_quota)}
          tone="warn"
          flagged={over}
          pill={over ? `+${overPct.toFixed(0)}% over` : undefined}
          sub="Sum of rep assignments"
        />
        <Metric
          label="Reps in Scope"
          value={String(report.rep_count)}
          sub={`${segments.length} segments · ${regions.length} regions`}
        />
        <Metric
          label="Fairness Flags"
          value={String(fairnessFlags)}
          tone="warn"
          flagged={fairnessFlags > 0}
          sub="Reps outside the fair band"
        />
      </StatStrip>

      <div className="card p-4">
        <SectionHead
          title="Fairness heatmap — segment × region"
          desc="Quota-to-opportunity ratio. Values near 1.0 indicate fair assignment."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-32" />
                {regions.map((reg) => (
                  <th key={reg} className="px-2 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slatebody">
                    {reg}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => (
                <tr key={seg}>
                  <td className="pr-3 text-right text-[12px] font-semibold uppercase tracking-wide text-slatebody">{seg}</td>
                  {regions.map((reg) => {
                    const v = cell(seg, reg);
                    const paint = paintbrushed.has(seg);
                    const { bg, text, label } = cellStyle(v, paint);
                    return (
                      <td key={reg} className={`rounded-lg px-2 py-2.5 text-center ${bg}`}>
                        {v == null ? (
                          <span className="text-[12px] text-slate-300">—</span>
                        ) : (
                          <>
                            <div className={`text-[11px] font-medium ${text}`}>{label}</div>
                            <div className={`font-display text-[15px] font-bold tabular-nums ${text}`}>{v.toFixed(2)}</div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </div>

      <FindingsCard findings={report.findings} />
    </div>
  );
}

// Four visually-distinct states so the map reads at a glance: Fair=green, Tight=amber,
// Loose=blue, Paintbrush=violet (a segment flag — clearly separate from the warm Tight tone).
function cellStyle(v: number | null, paint: boolean): { bg: string; text: string; label: string } {
  if (v == null) return { bg: "bg-slate-50 ring-1 ring-slate-100", text: "text-slate-300", label: "" };
  if (paint) return { bg: "bg-violet-50 ring-1 ring-violet-100", text: "text-violet-700", label: "Paintbrush" };
  if (v < 0.85) return { bg: "bg-amber-50 ring-1 ring-amber-100", text: "text-amber-700", label: "Tight" };
  if (v > 1.15) return { bg: "bg-blue-50 ring-1 ring-blue-100", text: "text-blue-700", label: "Loose" };
  return { bg: "bg-emerald-50 ring-1 ring-emerald-100", text: "text-emerald-700", label: "Fair" };
}

function Legend() {
  const items = [
    ["bg-emerald-500", "Fair (0.85–1.15)"],
    ["bg-amber-500", "Tight (< 0.85)"],
    ["bg-blue-500", "Loose (> 1.15)"],
    ["bg-violet-500", "Paintbrushed segment"],
  ];
  return (
    <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[11px] text-slatebody">
      {items.map(([dot, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
