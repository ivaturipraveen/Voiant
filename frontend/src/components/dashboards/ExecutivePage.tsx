import { fmtMoney, type ExecutiveSummaryResponse, type Finding } from "../../api";
import { Metric } from "../Shared";

const QUOTA_CODES = ["DEPLOYED", "PAINTBRUSH", "REP_OVERLOADED", "FAIRNESS", "TARGET"];

export default function ExecutivePage({ data, onOpenAudit }: { data: ExecutiveSummaryResponse; onOpenAudit?: () => void }) {
  const getMetric = (label: string) => {
    return data.metrics.find((x) => x.label.toLowerCase() === label.toLowerCase());
  };

  const topDownTarget = getMetric("Top-down target");
  const deployedQuota = getMetric("Deployed quota");
  const overAssignment = getMetric("Over-assignment");
  const teamAdditionalCapacity = getMetric("Team additional capacity");
  const fairnessFlags = getMetric("Fairness flags");

  return (
    <div className="space-y-6">
      {/* 1. Headline Finding Card */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row">
        <div className="flex-1 p-8 lg:pr-32 xl:pr-48">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#4a77b4]">
            Headline Finding <span className="ml-2 text-slate-300">01 / 03</span>
          </div>
          <h2 className="mb-4 font-display text-[22px] font-semibold leading-snug text-navy lg:pr-12 xl:pr-20">
            {data.headline_insight?.title || "Headline insight unavailable."}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500 lg:pr-8 xl:pr-16">
            {data.headline_insight?.description || "Description unavailable."}
          </p>
        </div>
        <div className="w-full bg-[#305a86] p-8 text-white lg:w-[320px] shrink-0">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-blue-100/70">Reclaimable Headroom</div>
          <div className="mb-1 font-display text-[44px] font-bold leading-none tracking-tight">
            {teamAdditionalCapacity?.value || "$0.0M"}
          </div>
          <div className="mb-8 text-[12px] text-blue-100/80">
            {data.headroom_context?.subtitle || "Context unavailable."}
          </div>
          <div className="mb-6 h-px w-full bg-white/10"></div>
          <p className="text-[12px] leading-relaxed text-blue-100/90" dangerouslySetInnerHTML={{ __html: data.headroom_context?.description?.replace('$24.0M', '<strong class="font-semibold text-white">$24.0M</strong>') || "" }}>
          </p>
        </div>
      </div>

      {/* 2. Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ExecMetricCard
          label="FY26 TARGET"
          value={topDownTarget?.value || "$0"}
          topRight={topDownTarget?.subtitle || ""}
          bottomLeft={topDownTarget?.trend_text || ""}
          bottomRight={topDownTarget?.trend_value || ""}
          bottomRightColor={topDownTarget?.trend_color_class || ""}
          borderColor="border-t-[#4a77b4]"
          chartColor="#4a77b4"
          chartFill="#4a77b4"
          chartLabel={topDownTarget?.chart_label || ""}
        />
        <ExecMetricCard
          label="DEPLOYED QUOTA"
          value={deployedQuota?.value || "$0"}
          topRight={deployedQuota?.subtitle || ""}
          bottomLeft={deployedQuota?.trend_text || ""}
          bottomRight={deployedQuota?.trend_value || ""}
          bottomRightColor={deployedQuota?.trend_color_class || ""}
          borderColor="border-t-[#cda962]"
          chartColor="#cda962"
          chartFill="#cda962"
          chartLabel={deployedQuota?.chart_label || ""}
        />
        <ExecMetricCard
          label="ATTAINMENT YTD"
          value={overAssignment?.value || "$0"}
          topRight={overAssignment?.subtitle || ""}
          bottomLeft={overAssignment?.trend_text || ""}
          bottomRight={overAssignment?.trend_value || ""}
          bottomRightColor={overAssignment?.trend_color_class || ""}
          borderColor="border-t-[#c45a55]"
          chartColor="#c45a55"
          chartFill="#c45a55"
          chartLabel={overAssignment?.chart_label || ""}
        />
        <ExecMetricCard
          label="FAIRNESS FLAGS"
          value={fairnessFlags?.value || "0"}
          topRight={fairnessFlags?.subtitle || ""}
          bottomLeft={fairnessFlags?.trend_text || ""}
          bottomRight={fairnessFlags?.trend_value || ""}
          bottomRightColor={fairnessFlags?.trend_color_class || ""}
          borderColor="border-t-[#4a77b4]"
          chartColor="#4a77b4"
          chartFill="#4a77b4"
          chartLabel={fairnessFlags?.chart_label || ""}
        />
      </div>

      {/* 3. Findings Table */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400 font-normal text-sm">§ 01.2</span>
            Findings This Period
          </h3>
          <div className="text-xs text-slate-400">Week of 22 June 2026 · Ranked by expected impact</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-[13.5px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-4 pr-3">§</th>
                  <th className="py-3 pr-4">Finding</th>
                  <th className="whitespace-nowrap py-3 pr-4">Source Agent</th>
                  <th className="whitespace-nowrap py-3 pr-4">Confidence</th>
                  <th className="whitespace-nowrap py-3 pr-4 text-[#4a77b4]">6-Wk Trend</th>
                  <th className="whitespace-nowrap py-3 pr-4 text-right">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.top_findings.map((f, i) => {
                  const trend = i === 0 ? { d: "M0 10 L20 8 L30 9 L45 5 L60 3", color: "#cda962", cy: 3 } :
                    i === 1 ? { d: "M0 12 L20 11 L30 9 L45 8 L60 6", color: "#c45a55", cy: 6 } :
                      { d: "M0 6 L20 8 L40 11 L60 13", color: "#cda962", cy: 13 };

                  return (
                    <tr key={i} className="align-top hover:bg-slate-50/50">
                      <td className="py-4 pl-4 pr-3 font-mono text-[12px] font-semibold text-slate-400">{i + 1}</td>
                      <td className="py-4 pr-4">
                        <div className="font-medium text-navy">{f.message}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                          {f.code.includes("PAINTBRUSH") ? "Actual TAM ranges $1.20M - $1.70M per rep. Recommend re-segmenting into A/B/C tiers by opportunity coverage. § 4.1 Rec 01." :
                            f.code.includes("REP_OVERLOADED") ? "Both carrying 140%+ of baseline capacity with pipeline coverage below team median. See § 3 for redistribution scenarios." :
                              "Root cause traces to two large accounts stalled at stage 3 for 60+ days."}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        <span className="text-[12.5px] text-slate-600">{sourceAgent(f)}</span>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        <ConfidenceBadge severity={f.severity} />
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4">
                        <svg width="60" height="16" viewBox="0 0 60 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d={trend.d} stroke={trend.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="58.5" cy={trend.cy} r="1.5" fill={trend.color} />
                        </svg>
                      </td>
                      <td className="whitespace-nowrap py-4 pr-4 text-right font-semibold text-navy">
                        {impact(f)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Basis of Analysis */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400 font-normal text-sm">§ 01.3</span>
            Basis of Analysis
          </h3>
          <div className="text-xs text-slate-400">Rapid7 specific interpretation rules currently applied</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="text-[13px] font-semibold text-navy">Rapid7 · FY26 Ruleset</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">3 Rules · Last Updated 22 Jun</div>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="text-[13px] leading-relaxed text-slate-600">
                <strong className="font-semibold text-navy">§ Target reconciliation.</strong> The $130.0M top-down company target is distinct from deployed quota. Over-assignment is retained as a cushion but not counted against attainment.
              </div>
            </div>
            <div>
              <div className="text-[13px] leading-relaxed text-slate-600">
                <strong className="font-semibold text-navy">§ Segment fold.</strong> Strategic segment accounts reassigned to Enterprise in Q4 FY25 remain excluded from FY26 Strategic count.
              </div>
            </div>
            <div>
              <div className="text-[13px] leading-relaxed text-slate-600">
                <strong className="font-semibold text-navy">§ Q4 boarding.</strong> Reps hired after 1 October 2025 receive prorated quota. Results reported separately from tenured cohort.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecMetricCard({
  label,
  value,
  topRight,
  bottomLeft,
  bottomRight,
  bottomRightColor,
  borderColor,
  chartColor,
  chartFill,
  chartLabel,
}: {
  label: string;
  value: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  bottomRightColor: string;
  borderColor: string;
  chartColor: string;
  chartFill?: string;
  chartLabel?: string;
}) {
  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm border-t-2 ${borderColor}`}>
      <div className="p-3 pb-0 z-10 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{topRight}</div>
        </div>
        <div className="mb-2 font-display text-[32px] font-bold tracking-tight text-navy">{value}</div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="truncate pr-2">{bottomLeft}</div>
          <div className={`font-bold shrink-0 ${bottomRightColor}`}>{bottomRight}</div>
        </div>
      </div>

      {/* Decorative Sparkline */}
      <div className="relative mt-2 h-10 w-full">
        <svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 40 L0 32 L25 30 L50 26 L75 24 L100 20 L100 40 Z" fill={chartFill || chartColor} opacity="0.1" />
          <path d="M0 32 L25 30 L50 26 L75 24 L100 20" stroke={chartColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="px-3 pb-3 pt-1 z-10 relative">
        <div className="text-[9px] font-medium uppercase tracking-widest text-slate-400">{chartLabel}</div>
      </div>
    </div>
  );
}

function sourceAgent(f: Finding): string {
  if (QUOTA_CODES.some((c) => f.code.includes(c))) return "Quota Equity";
  if (f.code.includes("HEADROOM") || f.code.includes("REPS_") || f.code.includes("REDISTRIB"))
    return "Capacity Headroom";
  return "Pipeline Hygiene";
}

function ConfidenceBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    critical: { label: "High", cls: "text-emerald-700", icon: "▲" },
    warn: { label: "Med", cls: "text-amber-600", icon: "♦" },
    info: { label: "Low", cls: "text-slate-500", icon: "▼" },
  };
  const b = map[severity] ?? map.info;
  return (
    <span className={`flex items-center gap-1.5 text-[12px] font-semibold ${b.cls}`}>
      <span className="text-[10px]">{b.icon}</span> {b.label}
    </span>
  );
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
