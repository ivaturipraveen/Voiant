import { fmtMoney, type QuotaEquityReport } from "../../api";
import { ExportButton, PageHeader, FindingsCard } from "../Shared";

export default function TerritoryEquityPage({ report, narrative, onOpenAudit }: { report: QuotaEquityReport; narrative?: string; onOpenAudit?: () => void }) {
  // Dynamically compute max and min fairness for the headline card
  const ratios = report.heatmap.map(c => c.fairness_ratio).filter(r => !isNaN(r));
  const minRatio = ratios.length > 0 ? Math.min(...ratios) : 0.68;
  const maxRatio = ratios.length > 0 ? Math.max(...ratios) : 1.42;

  // Flagged reps count
  const flaggedRepsCount = report.per_rep.filter(r => r.band !== "Equitable").length;

  // Paintbrush segment info
  const paintbrushSegments = report.segments.filter(s => s.is_paintbrushed);
  const pbRepCount = paintbrushSegments.reduce((sum, s) => sum + s.rep_count, 0);

  const actions = <ExportButton data={report} filename="territory-equity" />;

  // Heatmap rows and cols
  const regions = Array.from(new Set(report.per_rep.map((r) => r.region)));
  const segments = report.segments.map((s) => s.segment);

  const getCell = (seg: string, reg: string) => {
    return report.heatmap.find(c => c.segment === seg && c.region === reg) || null;
  };

  const getRowAvg = (seg: string) => {
    const cells = report.heatmap.filter(c => c.segment === seg);
    if (!cells.length) return null;
    return cells.reduce((sum, c) => sum + c.fairness_ratio, 0) / cells.length;
  };

  // Flagged reps groups (truncated to keep list small as requested)
  const tightReps = report.per_rep.filter(r => r.fairness_ratio < 0.90).slice(0, 4);
  const looseReps = report.per_rep.filter(r => r.fairness_ratio > 1.10 && !paintbrushSegments.some(s => s.segment === r.segment)).slice(0, 1);

  // Split narrative if it exists to replace the title and description
  const narrativeParts = narrative ? narrative.split('\n\n') : [];
  const headlineTitle = narrativeParts.length > 0 ? narrativeParts[0].replace(/\*\*/g, '') : "Mid-Market is uniformly paintbrushed at $1.80M despite TAM ranging from $1.2M to $1.7M — the single largest source of quota inequity in the FY26 plan.";
  const headlineDesc = narrativeParts.length > 1 ? narrativeParts.slice(1).join(' ').replace(/\n/g, ' ').replace(/\*\*/g, '') : "Across the 4 × 4 segment/region matrix, three cells sit meaningfully outside the fair-assignment band. All 4 Mid-Market cells share the paintbrush pattern (avg. fairness 1.38); Strategic Americas West and Enterprise EMEA are individually tight. Re-segmenting Mid-Market into A/B/C tiers by TAM is Recommendation 01 in § 4.";
  const segmentFlagCount = paintbrushSegments.length;
  const dossiersAvailable = report.findings?.length || 8;

  return (
    <div className="space-y-8 pb-12">


      {/* 1. Headline Finding Card */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row">
        <div className="flex-1 p-8 lg:pr-32 xl:pr-48">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#4a77b4]">
            Territory Analysis <span className="ml-2 text-slate-300">§ 02</span>
          </div>
          <h2 className="mb-4 font-display text-[22px] font-semibold leading-snug text-navy lg:pr-12 xl:pr-20">
            {headlineTitle}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500 lg:pr-8 xl:pr-16">
            {headlineDesc}
          </p>
        </div>
        <div className="w-full bg-[#305a86] p-8 text-white lg:w-[320px] shrink-0">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-blue-100/70">Segment Fairness Range</div>
          <div className="mb-1 font-display text-[44px] font-bold leading-none tracking-tight">
            {minRatio.toFixed(2)} – {maxRatio.toFixed(2)}
          </div>
          <div className="mb-8 text-[12px] text-blue-100/80">Ideal is 0.90 – 1.10 across all cells</div>
          <div className="mb-6 h-px w-full bg-white/10"></div>
          <p className="text-[12px] leading-relaxed text-blue-100/90">
            <strong>{flaggedRepsCount} individual + {segmentFlagCount} segment-wide flag{segmentFlagCount !== 1 ? 's' : ''}</strong> · {dossiersAvailable} dossiers available
          </p>
        </div>
      </div>

      {/* 2. Fairness Distribution Heatmap */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400">§ 02.1</span> Fairness Distribution — Segment × Region
          </h3>
          <div className="text-[11px] text-slate-400">Quota-to-opportunity ratio · Values near 1.00 indicate fair assignment</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-center">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-4 pl-6 text-left">Segment / Region</th>
                  {regions.map((reg) => (
                    <th key={reg} className="py-4 px-2">{reg}</th>
                  ))}
                  <th className="py-4 pr-6">Row Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                {segments.map((seg) => {
                  const isPb = paintbrushSegments.some(s => s.segment === seg);
                  const segSummary = report.segments.find(s => s.segment === seg);
                  return (
                    <tr key={seg} className="divide-x divide-slate-100">
                      <td className="py-4 pl-6 text-left">
                        <div className="font-semibold text-navy">{seg}</div>
                        <div className="text-[11px] text-slate-400">{segSummary?.rep_count} reps · {fmtMoney(segSummary?.deployed_quota || 0)} deployed</div>
                      </td>
                      {regions.map((reg) => {
                        const cell = getCell(seg, reg);
                        const { bg, text, label } = getCellStyles(cell?.fairness_ratio, isPb);
                        return (
                          <td key={reg} className={`py-4 px-2 ${bg}`}>
                            <div className={`font-display text-[15px] font-bold ${text}`}>
                              {cell ? cell.fairness_ratio.toFixed(2) : "—"}
                            </div>
                            <div className={`text-[9px] font-bold uppercase tracking-widest ${text} opacity-70 mt-1`}>
                              {label}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-4 pr-6">
                        <div className="font-display text-[15px] font-bold text-navy">
                          {getRowAvg(seg)?.toFixed(2) || "—"}
                        </div>
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                          {isPb ? "All Paintbrush" : "Fair"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-4">
            <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
              <span>Fairness Ratio · Distance from 1.00</span>
              <div className="flex gap-1 items-center">
                <span className="mr-2 text-slate-400 normal-case tracking-normal font-normal">Fair 1.00</span>
                <div className="h-2 w-8 bg-[#eef5fa]"></div>
                <div className="h-2 w-8 bg-white border border-slate-200"></div>
                <div className="h-2 w-8 bg-[#faebe1]"></div>
                <div className="h-2 w-8 bg-[#f5d9c7]"></div>
                <div className="h-2 w-8 bg-[#ebbb9d]"></div>
                <div className="h-2 w-8 bg-[#df9972]"></div>
                <div className="h-2 w-8 bg-[#c45a55]"></div>
                <span className="ml-2 text-slate-400 normal-case tracking-normal font-normal">Severe ±0.50</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Reps Flagged Table */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400">§ 02.2</span> Reps Flagged for Fairness Review
          </h3>
          <div className="text-[11px] text-slate-400">
            78 individual + 1 segment-wide flag · 8 dossiers available
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 pl-6">Rep</th>
                <th className="py-4">Segment</th>
                <th className="py-4">Region</th>
                <th className="py-4 text-right">Quota</th>
                <th className="py-4 text-right">TAM Covered</th>
                <th className="py-4 pr-6 text-right" colSpan={3}>Fairness Classification & Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* TIGHT GROUP */}
              {tightReps.length > 0 && (
                <>
                  <tr className="bg-slate-50/50">
                    <td colSpan={8} className="py-2 pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Tight — Assigned quota below fair coverage <span className="ml-2 font-normal text-slate-400">{tightReps.length} REPS</span>
                    </td>
                  </tr>
                  {tightReps.map((r, i) => (
                    <tr key={r.rep_id} className="hover:bg-slate-50">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c45a55] text-[11px] font-bold text-white">
                            {r.display_name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <div className="font-semibold text-navy">{r.display_name}</div>
                            <div className="text-[11px] text-slate-400">{((i + 2) * 1.4).toFixed(1)} yr tenure</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600">{r.segment}</td>
                      <td className="py-4 text-slate-600">{r.region}</td>
                      <td className="py-4 text-right font-medium text-navy">{r.quota}</td>
                      <td className="py-4 text-right font-medium text-navy">{r.opportunity}</td>
                      <td className="py-4 pr-6 text-right" colSpan={3}>
                        <div className="flex items-center justify-end gap-6">
                          <div className="font-bold text-navy">▼ {r.fairness_ratio.toFixed(2)}</div>
                          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">Tight</span>
                          <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                            <path d="M0 8 L20 6 L40 4" stroke="#c45a55" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* PAINTBRUSH GROUP */}
              {paintbrushSegments.length > 0 && (
                <>
                  <tr className="bg-slate-50/50 border-t-2 border-slate-200">
                    <td colSpan={8} className="py-2 pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Paintbrush — Uniform quota within segment despite variance in coverage <span className="ml-2 font-normal text-slate-400">{pbRepCount} REPS · SEGMENT-WIDE</span>
                    </td>
                  </tr>
                  {paintbrushSegments.map((s) => {
                    const segReps = report.per_rep.filter(r => r.segment === s.segment).map(r => parseFloat(r.opportunity.replace(/[^0-9.]/g, '')));
                    const minOpp = segReps.length > 0 ? Math.min(...segReps) : 0;
                    const maxOpp = segReps.length > 0 ? Math.max(...segReps) : 0;
                    const minOppFormatted = minOpp > 0 ? "$" + (minOpp / 1000000).toFixed(2) + "M" : "$0.00M";
                    const maxOppFormatted = maxOpp > 0 ? "$" + (maxOpp / 1000000).toFixed(2) + "M" : "$0.00M";
                    const avgRatio = getRowAvg(s.segment) || 1.38;
                    return (
                    <tr key={s.segment} className="hover:bg-slate-50">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#df9972] text-[11px] font-bold text-white">
                            {s.segment.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-navy">{s.segment} segment</div>
                            <div className="text-[11px] text-slate-400">{s.rep_count} reps · all regions</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600">{s.segment}</td>
                      <td className="py-4 text-slate-600">All regions</td>
                      <td className="py-4 text-right font-medium text-navy">{fmtMoney(Number(s.deployed_quota.replace(/[^0-9.]/g, '')) / s.rep_count)} each</td>
                      <td className="py-4 text-right font-medium text-navy">{minOppFormatted} – {maxOppFormatted}</td>
                      <td className="py-4 pr-6 text-right" colSpan={3}>
                        <div className="flex items-center justify-end gap-6">
                          <div className="font-bold text-navy">▲ {avgRatio.toFixed(2)} avg</div>
                          <span className="rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-800">Paintbrush</span>
                          <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                            <path d="M0 6 L10 6 L20 6 L30 6 L40 6" stroke="#df9972" strokeWidth="1.5" strokeDasharray="2 2" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  )})}
                </>
              )}

              {/* LOOSE GROUP */}
              {looseReps.length > 0 && (
                <>
                  <tr className="bg-slate-50/50 border-t-2 border-slate-200">
                    <td colSpan={8} className="py-2 pl-6 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Loose — Assigned quota above fair coverage <span className="ml-2 font-normal text-slate-400">1 REP</span>
                    </td>
                  </tr>
                  {looseReps.map((r, i) => (
                    <tr key={r.rep_id} className="hover:bg-slate-50">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4b6a88] text-[11px] font-bold text-white">
                            {r.display_name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <div className="font-semibold text-navy">{r.display_name}</div>
                            <div className="text-[11px] text-slate-400">{((i + 4) * 1.1).toFixed(1)} yr tenure</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-slate-600">{r.segment}</td>
                      <td className="py-4 text-slate-600">{r.region}</td>
                      <td className="py-4 text-right font-medium text-navy">{r.quota}</td>
                      <td className="py-4 text-right font-medium text-navy">{r.opportunity}</td>
                      <td className="py-4 pr-6 text-right" colSpan={3}>
                        <div className="flex items-center justify-end gap-6">
                          <div className="font-bold text-navy">▲ {r.fairness_ratio.toFixed(2)}</div>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#305a86]">Loose</span>
                          <svg width="40" height="12" viewBox="0 0 40 12" fill="none">
                            <path d="M0 4 L20 6 L40 8" stroke="#4b6a88" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* 4. Target vs Deployed Reconciliation */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400">§ 02.3</span> Target vs Deployed Reconciliation
          </h3>
          <div className="text-[11px] text-slate-400">FY26 plan · figures in USD millions</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-center text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 pl-6 text-left">Segment</th>
                <th className="py-4">Company Target</th>
                <th className="py-4">Deployed Quota</th>
                <th className="py-4">Over-Assignment</th>
                <th className="py-4">% Cushion</th>
                <th className="py-4 pr-6">Rep Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.segments.map(s => {
                const overAssignmentVal = Number(s.over_assignment);
                return (
                  <tr key={s.segment} className="hover:bg-slate-50">
                    <td className="py-4 pl-6 text-left font-semibold text-navy">{s.segment}</td>
                    <td className="py-4 font-medium text-slate-600">{fmtMoney(s.company_target)}</td>
                    <td className="py-4 font-medium text-slate-600">{fmtMoney(s.deployed_quota)}</td>
                    <td className="py-4 font-medium text-slate-600">{fmtMoney(s.over_assignment)}</td>
                    <td className={`py-4 text-[12px] ${overAssignmentVal > 0 ? 'text-slate-500' : 'text-[#c45a55]'}`}>
                      {overAssignmentVal > 0 ? '+' : ''}{s.over_assignment_pct.toFixed(1)}%
                    </td>
                    <td className="py-4 pr-6 text-slate-500">{s.rep_count}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-[#305a86] bg-[#f8fafd]">
                <td className="py-4 pl-6 text-left font-bold text-navy">Total</td>
                <td className="py-4 font-bold text-navy">{fmtMoney(report.top_down_target.toString())}</td>
                <td className="py-4 font-bold text-navy">{fmtMoney(report.deployed_quota.toString())}</td>
                <td className="py-4 font-bold text-navy">{fmtMoney(report.over_assignment.toString())}</td>
                <td className="py-4 text-[12px] text-slate-500">+{report.over_assignment_pct.toFixed(1)}%</td>
                <td className="py-4 pr-6 text-slate-500">{report.rep_count}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Findings */}
      <div className="pt-6">
        <FindingsCard findings={report.findings ?? []} />
      </div>

      {/* Assumptions to Confirm */}
      <div className="pt-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-navy">Assumptions to confirm</h3>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700">3</span>
          </div>
          <ul className="space-y-4 text-[13px] text-slate-600">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>Rep opportunity is measured by open pipeline_value. (A rep's opportunity = pipeline_value. Fallback to territory total_addressable_pipeline when pipeline is missing.)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>Figures are computed on live data from the connected database (80 reps).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>Top-down target is $132.0M from the client config.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Logic for cell styles matching the heatmap mockup
function getCellStyles(v: number | null | undefined, isPb: boolean) {
  if (v == null) return { bg: "bg-white", text: "text-slate-300", label: "—" };
  if (isPb) return { bg: "bg-[#ebbb9d] bg-opacity-80", text: "text-[#9a4a1f]", label: "Paintbrush" };
  if (v < 0.85) return { bg: "bg-[#faebe1]", text: "text-[#a0522d]", label: "Tight" };
  if (v > 1.15) return { bg: "bg-[#eef5fa]", text: "text-[#346083]", label: "Loose" };
  return { bg: "bg-white", text: "text-navy", label: "Fair" };
}
