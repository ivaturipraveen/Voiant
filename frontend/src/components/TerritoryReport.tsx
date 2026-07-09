import { useEffect, useState, type ReactNode } from "react";
import { api, fmtMoney, type FairnessResult, type QuotaEquityReport, type SegmentSummary } from "../api";
import { Avatar, Sparkline } from "./Shared";

type CellKind = "fair" | "tight" | "loose" | "paintbrush";

const CELL_STYLE: Record<CellKind, { bg: string; text: string; label: string }> = {
  fair: { bg: "bg-slate-50", text: "text-slate-600", label: "Fair" },
  tight: { bg: "bg-orange-50", text: "text-orange-800", label: "Tight" },
  loose: { bg: "bg-amber-50", text: "text-amber-800", label: "Loose" },
  paintbrush: { bg: "bg-orange-100", text: "text-orange-900", label: "Paintbrush" },
};

const BAND_META: Record<string, { title: string; badgeCls: string }> = {
  Underloaded: {
    title: "Underloaded — assigned quota below fair coverage",
    badgeCls: "bg-red-50 text-red-700 border-red-100",
  },
  Stretched: {
    title: "Stretched — assigned quota above fair coverage",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-100",
  },
  Overloaded: {
    title: "Overloaded — quota far above sustainable coverage",
    badgeCls: "bg-red-50 text-red-800 border-red-100",
  },
};

function fairnessDirection(rep: FairnessResult): "up" | "down" {
  return rep.deviation < 0 ? "down" : "up";
}

function repTrend(rep: FairnessResult): number[] {
  if (rep.trend_6w && rep.trend_6w.length >= 2) return rep.trend_6w;
  const n = 6;
  const start = rep.segment_median_ratio;
  const end = rep.fairness_ratio;
  return Array.from({ length: n }, (_, i) => start + ((end - start) * i) / (n - 1));
}

function segmentAvgTrend(reps: FairnessResult[]): number[] {
  if (!reps.length) return [1, 1, 1, 1, 1, 1];
  const n = reps[0].trend_6w?.length ?? 6;
  return Array.from({ length: n }, (_, i) => {
    const sum = reps.reduce((a, r) => a + repTrend(r)[i], 0);
    return sum / reps.length;
  });
}

function cellKind(v: number | null, paint: boolean): CellKind {
  if (v == null) return "fair";
  if (paint) return "paintbrush";
  if (v < 0.85) return "tight";
  if (v > 1.15) return "loose";
  return "fair";
}

function avgFairness(rows: FairnessResult[]): number | null {
  if (!rows.length) return null;
  return rows.reduce((a, r) => a + r.fairness_ratio, 0) / rows.length;
}

function fmtRatio(v: number): string {
  return v.toFixed(2);
}

function proratedTarget(seg: SegmentSummary, totalDeployed: number, topDown: number): number {
  const d = parseFloat(seg.deployed_quota);
  return totalDeployed > 0 ? topDown * (d / totalDeployed) : 0;
}

// Map the Equitable fairness band from /config to a displayable ratio range (vs segment
// median = 1.00). Mirrors backend banding: deviation = (ratio − median) / median.
function idealFairnessRange(bands: Array<{ name: string; max_deviation: number }>): { low: number; high: number } | null {
  const ordered = [...bands].sort((a, b) => a.max_deviation - b.max_deviation);
  const eqIdx = ordered.findIndex((b) => b.name === "Equitable");
  if (eqIdx < 0) return null;
  const equitable = ordered[eqIdx];
  const prev = eqIdx > 0 ? ordered[eqIdx - 1] : null;
  const lowDev = prev?.max_deviation ?? -0.1;
  return { low: 1 + lowDev, high: 1 + equitable.max_deviation };
}

// Territory & Quota rendered as the report's §02 sections — headline, heatmap,
// flagged-rep dossiers, and target reconciliation. All figures from the live report.
export default function TerritoryReport({ report }: { report: QuotaEquityReport }) {
  const [idealRange, setIdealRange] = useState<{ low: number; high: number } | null>(null);

  useEffect(() => {
    api
      .config()
      .then((cfg) => setIdealRange(idealFairnessRange(cfg.fairness_bands)))
      .catch(() => setIdealRange(null));
  }, []);

  const paintbrushed = new Set(report.segments.filter((s) => s.is_paintbrushed).map((s) => s.segment));
  const segments = report.segments.map((s) => s.segment);
  const regions = Array.from(new Set(report.per_rep.map((r) => r.region))).sort();

  const cell = (seg: string, reg: string) => {
    const rows = report.per_rep.filter((r) => r.segment === seg && r.region === reg);
    return avgFairness(rows);
  };

  const rowAvg = (seg: string) => {
    const rows = report.per_rep.filter((r) => r.segment === seg);
    return avgFairness(rows);
  };

  const allRatios = report.per_rep.map((r) => r.fairness_ratio);
  const minRatio = allRatios.length ? Math.min(...allRatios) : 0;
  const maxRatio = allRatios.length ? Math.max(...allRatios) : 0;

  const flaggedReps = report.per_rep.filter((r) => r.band !== "Equitable");
  const paintSeg = report.segments.find((s) => s.is_paintbrushed);

  const headlineFinding =
    report.findings.find((f) => f.code.includes("PAINTBRUSH")) ??
    report.findings.find((f) => f.severity === "critical") ??
    report.findings[0];

  const headlineTitle = paintSeg
    ? `${paintSeg.segment} is uniformly paintbrushed at ${fmtMoney(
        parseFloat(paintSeg.deployed_quota) / paintSeg.rep_count
      )} despite varying pipeline coverage — the single largest source of quota inequity in the plan.`
    : headlineFinding?.message ?? "Territory and quota fairness review across segments and regions.";

  const totalDeployed = parseFloat(report.deployed_quota);
  const topDown = parseFloat(report.top_down_target);

  // Group individual flagged reps (exclude paintbrush segment members from tight/loose groups)
  const paintRepIds = paintSeg
    ? new Set(report.per_rep.filter((r) => r.segment === paintSeg.segment).map((r) => r.rep_id))
    : new Set<string>();

  const groups = ["Underloaded", "Stretched", "Overloaded"] as const;
  const grouped = groups
    .map((band) => ({
      band,
      reps: flaggedReps.filter((r) => r.band === band && !paintRepIds.has(r.rep_id)),
    }))
    .filter((g) => g.reps.length > 0);

  const segmentWideFlags = paintSeg ? 1 : 0;
  const individualFlags = flaggedReps.filter((r) => !paintRepIds.has(r.rep_id)).length;
  const dossierCount = individualFlags + segmentWideFlags;

  const reconRows = report.segments.map((seg) => {
    const deployed = parseFloat(seg.deployed_quota);
    const target = proratedTarget(seg, totalDeployed, topDown);
    const over = deployed - target;
    const cushion = target > 0 ? (over / target) * 100 : 0;
    return { seg, deployed, target, over, cushion, repCount: seg.rep_count, paint: seg.is_paintbrushed };
  });

  const totalTarget = reconRows.reduce((a, r) => a + r.target, 0);
  const totalOver = totalDeployed - totalTarget;
  const totalCushion = totalTarget > 0 ? (totalOver / totalTarget) * 100 : 0;

  const fy = `FY${String(new Date().getFullYear()).slice(2)}`;

  return (
    <div className="space-y-8 pb-4">
      {/* § 02 headline */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[2.3fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Territory Analysis
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">§ 02</span>
          </div>
          <h2 className="mt-3 font-display text-[22px] font-semibold leading-snug tracking-tight text-navy">{headlineTitle}</h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
            {headlineFinding?.message}{" "}
            {report.findings.find((f) => f.code.includes("DEPLOYED"))?.message ?? ""}
          </p>
        </div>

        <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#33518f] to-[#3f5fa1] p-6 text-white">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Segment Fairness Range
            </div>
            <div className="mt-4 font-display text-[40px] font-extrabold leading-none tracking-tight text-white">
              {fmtRatio(minRatio)} — {fmtRatio(maxRatio)}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
              {idealRange
                ? `Ideal is ${fmtRatio(idealRange.low)} – ${fmtRatio(idealRange.high)} across all cells`
                : "Ideal range follows the Equitable fairness band in config"}
            </p>
          </div>
          <p className="mt-auto pt-8 text-[11.5px] leading-relaxed text-white/45">
            {flaggedReps.length} of {report.rep_count} reps outside the fair-assignment band.
            {paintSeg &&
              ` ${paintSeg.rep_count} reps in the ${paintSeg.segment} segment share a single paintbrushed quota.`}
          </p>
        </div>
      </section>

      {/* § 02.1 Fairness heatmap */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 02.1</span>
            Fairness Distribution — Segment × Region
          </h3>
          <span className="text-[11px] text-slate-400">
            Quota-to-opportunity ratio · Values near 1.00 indicate fair assignment
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <th className="px-4 py-3 font-semibold">Segment / Region</th>
                {regions.map((reg) => (
                  <th key={reg} className="px-2 py-3 text-center font-semibold">
                    {reg}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-semibold">Row Avg</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((seg) => {
                const summary = report.segments.find((s) => s.segment === seg)!;
                const paint = paintbrushed.has(seg);
                return (
                  <tr key={seg} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-navy">{seg}</div>
                      <div className="text-[11px] text-slate-400">
                        {summary.rep_count} reps · {fmtMoney(summary.deployed_quota)} deployed
                      </div>
                    </td>
                    {regions.map((reg) => {
                      const v = cell(seg, reg);
                      const kind = cellKind(v, paint);
                      const st = CELL_STYLE[kind];
                      return (
                        <td key={reg} className="p-1.5">
                          <div className={`rounded-lg px-2 py-2.5 text-center ${st.bg}`}>
                            {v == null ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <>
                                <div className={`font-display text-[15px] font-bold tabular-nums ${st.text}`}>
                                  {fmtRatio(v)}
                                </div>
                                <div className={`text-[9.5px] font-semibold uppercase tracking-wide ${st.text} opacity-80`}>
                                  {st.label}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {(() => {
                      const v = rowAvg(seg);
                      const kind = cellKind(v, paint);
                      const st = CELL_STYLE[kind];
                      return (
                        <td className="p-1.5">
                          <div className={`rounded-lg px-2 py-2.5 text-center ${st.bg}`}>
                            {v == null ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <>
                                <div className={`font-display text-[15px] font-bold tabular-nums ${st.text}`}>
                                  {fmtRatio(v)}
                                </div>
                                <div className={`text-[9.5px] font-semibold uppercase tracking-wide ${st.text} opacity-80`}>
                                  {st.label}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <HeatmapLegend />
      </section>

      {/* § 02.2 Flagged reps */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 02.2</span>
            Reps Flagged for Fairness Review
          </h3>
          <span className="text-[11px] text-slate-400">
            {individualFlags} individual · {segmentWideFlags} segment-wide flag · {dossierCount} dossiers available
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <th className="py-2.5 pl-4 pr-3 font-semibold">Rep</th>
                <th className="py-2.5 pr-3 font-semibold">Segment</th>
                <th className="py-2.5 pr-3 font-semibold">Region</th>
                <th className="py-2.5 pr-3 font-semibold">Quota</th>
                <th className="py-2.5 pr-3 font-semibold">TAM Covered</th>
                <th className="py-2.5 pr-3 font-semibold">Fairness</th>
                <th className="py-2.5 pr-3 font-semibold">Classification</th>
                <th className="py-2.5 pr-4 font-semibold">Trend</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ band, reps }) => {
                const g = BAND_META[band];
                return (
                  <GroupRows key={band} title={`${g.title} · ${reps.length} rep${reps.length === 1 ? "" : "s"}`}>
                    {reps.slice(0, 8).map((r) => (
                      <RepRow key={r.rep_id} rep={r} badgeCls={g.badgeCls} />
                    ))}
                  </GroupRows>
                );
              })}

              {paintSeg && (() => {
                const paintReps = report.per_rep.filter((r) => r.segment === paintSeg.segment);
                const paintAvg = rowAvg(paintSeg.segment) ?? 0;
                const paintMedian = paintReps[0]?.segment_median_ratio ?? 1;
                const paintDir = paintAvg < paintMedian ? "down" : "up";
                return (
                <GroupRows
                  title={`Paintbrush — uniform quota within segment despite variance in coverage · ${paintSeg.rep_count} reps · segment-wide`}
                >
                  <tr className="border-b border-slate-100 align-middle">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={paintSeg.segment} />
                        <div>
                          <div className="font-medium text-navy">{paintSeg.segment} segment</div>
                          <div className="text-[11px] text-slate-400">
                            {paintSeg.rep_count} reps · all regions
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{paintSeg.segment}</td>
                    <td className="py-3 pr-3 text-slate-500">All regions</td>
                    <td className="py-3 pr-3 font-semibold tabular-nums text-navy">
                      {fmtMoney(parseFloat(paintSeg.deployed_quota) / paintSeg.rep_count)} each
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-slate-500">
                      {fmtMoney(parseFloat(paintSeg.total_pipeline) / paintSeg.rep_count)} avg
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                          paintDir === "down" ? "text-red-600" : "text-flag-text"
                        }`}
                      >
                        {paintDir === "down" ? "▼" : "▲"} {fmtRatio(paintAvg)} avg
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-orange-800">
                        Paintbrush
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Sparkline
                        data={segmentAvgTrend(paintReps)}
                        color={paintDir === "down" ? "#EF4444" : "#B7791F"}
                        className="h-5 w-20"
                      />
                    </td>
                  </tr>
                </GroupRows>
                );
              })()}
            </tbody>
          </table>
        </div>
      </section>

      {/* § 02.3 Target reconciliation */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 02.3</span>
            Target vs Deployed Reconciliation
          </h3>
          <span className="text-[11px] text-slate-400">{fy} plan · figures in USD millions</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                <th className="py-2.5 pl-4 pr-3 font-semibold">Segment</th>
                <th className="py-2.5 pr-3 text-right font-semibold">Company Target</th>
                <th className="py-2.5 pr-3 text-right font-semibold">Deployed Quota</th>
                <th className="py-2.5 pr-3 text-right font-semibold">Over-Assignment</th>
                <th className="py-2.5 pr-3 text-right font-semibold">% Cushion</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Rep Count</th>
              </tr>
            </thead>
            <tbody>
              {reconRows.map(({ seg, deployed, target, over, cushion, repCount, paint }) => (
                <tr key={seg.segment} className="border-b border-slate-100">
                  <td className="py-3 pl-4 pr-3 font-medium text-navy">{seg.segment}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-600">{fmtMoney(target)}</td>
                  <td className="py-3 pr-3 text-right font-semibold tabular-nums text-navy">{fmtMoney(deployed)}</td>
                  <td className="py-3 pr-3 text-right tabular-nums text-slate-600">{fmtMoney(over)}</td>
                  <td className="py-3 pr-3 text-right">
                    <span className={`tabular-nums ${paint && cushion > 25 ? "font-semibold text-flag-text" : "text-slate-600"}`}>
                      {paint && cushion > 25 && <span className="mr-0.5">▲</span>}+{cushion.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-slate-600">{repCount}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="py-3 pl-4 pr-3 text-navy">Total</td>
                <td className="py-3 pr-3 text-right tabular-nums text-navy">{fmtMoney(totalTarget)}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-navy">{fmtMoney(totalDeployed)}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-navy">{fmtMoney(totalOver)}</td>
                <td className="py-3 pr-3 text-right tabular-nums text-navy">+{totalCushion.toFixed(1)}%</td>
                <td className="py-3 pr-4 text-right tabular-nums text-navy">{report.rep_count}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Company targets prorated from the top-down plan ({fmtMoney(topDown)}) by each segment's share of deployed quota.
          Deployed and target are distinct metrics — see interpretation rules.
        </p>
      </section>

      {/* Assumptions (governance, from the run) */}
      {report.assumptions.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Assumptions to confirm
          </div>
          <ul className="space-y-2">
            {report.assumptions.map((a) => (
              <li key={a.id} className="flex gap-2 text-[12.5px] leading-snug text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flag-text/70" />
                {a.statement}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function GroupRows({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}

function RepRow({
  rep,
  badgeCls,
}: {
  rep: FairnessResult;
  badgeCls: string;
}) {
  const dir = fairnessDirection(rep);
  return (
    <tr className="border-b border-slate-100 align-middle">
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={rep.display_name} />
          <div>
            <div className="font-medium text-navy">{rep.display_name}</div>
            <div className="text-[11px] text-slate-400">{rep.rep_id}</div>
          </div>
        </div>
      </td>
      <td className="py-3 pr-3 text-slate-600">{rep.segment}</td>
      <td className="py-3 pr-3 text-slate-600">{rep.region}</td>
      <td className="py-3 pr-3 font-semibold tabular-nums text-navy">{fmtMoney(rep.quota)}</td>
      <td className="py-3 pr-3 tabular-nums text-slate-600">{fmtMoney(rep.opportunity)}</td>
      <td className="py-3 pr-3">
        <span
          className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
            dir === "down" ? "text-red-600" : "text-flag-text"
          }`}
        >
          {dir === "down" ? "▼" : "▲"} {fmtRatio(rep.fairness_ratio)}
        </span>
      </td>
      <td className="py-3 pr-3">
        <span className={`rounded border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${badgeCls}`}>
          {rep.band}
        </span>
      </td>
      <td className="py-3 pr-4">
        <Sparkline
          data={repTrend(rep)}
          color={dir === "down" ? "#EF4444" : "#B7791F"}
          className="h-5 w-20"
        />
      </td>
    </tr>
  );
}

function HeatmapLegend() {
  const items: [string, string][] = [
    ["bg-slate-100", "Fair · 1.00"],
    ["bg-orange-50", "Tight · < 0.85"],
    ["bg-amber-50", "Loose · > 1.15"],
    ["bg-orange-200", "Paintbrush · uniform segment quota"],
  ];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-slate-400">
      <span className="font-semibold uppercase tracking-wide">Fairness ratio</span>
      {items.map(([dot, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded ${dot}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
