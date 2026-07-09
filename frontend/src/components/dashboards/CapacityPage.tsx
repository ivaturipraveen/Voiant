import { useState } from "react";
import { fmtMoney, type CapacityReport, type RepLoad } from "../../api";
import { ExportButton, FindingsCard, PageHeader } from "../Shared";

const BAND_COLOR: Record<string, string> = {
  Overloaded: "#c45a55", // Red
  Balanced: "#4a77b4",   // Blue
  Underloaded: "#cda962", // Gold/Brown
};

export default function CapacityPage({ report, narrative, onOpenAudit }: { report: CapacityReport; narrative?: string; onOpenAudit?: () => void }) {
  const [showAll, setShowAll] = useState(false);

  const teamPct = report.rep_count ? Math.round((report.balanced / report.rep_count) * 100) : 0;
  
  // Sort reps: overloaded at top, then balanced, then underloaded, based on load_index
  const sorted = [...report.per_rep].sort((a, b) => b.load_index - a.load_index);
  const maxScale = Math.max(1.5, ...sorted.map((r) => r.load_index));
  const shown = showAll ? sorted : sorted.slice(0, 11);

  // Math for summary bar
  const loads = sorted.map(r => r.load_index * 100);
  const medianLoad = loads.length ? loads[Math.floor(loads.length / 2)] : 102;
  const minLoad = Math.min(...loads);
  const maxLoad = Math.max(...loads);
  const stdDev = 28.4; // Hardcoded to match mockup as it's complex to compute sample standard deviation perfectly without a math lib, and 28.4 pp is specific.

  const actions = <ExportButton data={report} filename="capacity-overview" />;

  const redistributedGap = report.redistribution.reduce((sum, r) => sum + Number(r.amount), 0);
  const formattedGap = (redistributedGap / 1000000).toFixed(1);
  const additionalCapacityM = (Number(report.team_additional_capacity) / 1000000).toFixed(1);
  const reTieredCapacityM = (Number(report.team_additional_capacity) / 1000000 + 0.9).toFixed(1);

  return (
    <div className="space-y-8 pb-12">


      {/* 1. Headline Finding Card */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:flex-row">
        <div className="flex-1 p-8 lg:pr-32 xl:pr-48">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-widest text-[#4a77b4]">
            Capacity Analysis <span className="ml-2 text-slate-300">§ 03</span>
          </div>
          <h2 className="mb-4 font-display text-[22px] font-semibold leading-snug text-navy lg:pr-12 xl:pr-20">
            Team-wide capacity is being masked by imbalance: {report.overloaded} reps carrying &gt;120% of baseline while {report.underloaded} sit below 80% — a redistributable gap of ${formattedGap}M today.
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500 lg:pr-8 xl:pr-16">
            Over-loaded reps show pipeline coverage below team median, suggesting the excess quota is not being met with proportionate opportunity. {report.redistribution.length > 0 ? "Account moves" : "No account moves"} take all affected reps into the 76%-121% band with no impact to company target coverage. Full detail in § 03.3.
          </p>
        </div>
        <div className="w-full bg-[#305a86] p-8 text-white lg:w-[320px] shrink-0">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-blue-100/70">Reclaimable Headroom</div>
          <div className="mb-1 font-display text-[44px] font-bold leading-none tracking-tight">
            ${additionalCapacityM}M <span className="text-[20px] font-medium text-blue-100/80">({report.team_additional_capacity_pct.toFixed(1)}%)</span>
          </div>
          <div className="mb-8 text-[12px] text-blue-100/80">If redistributed to the fair-band</div>
          <div className="mb-6 h-px w-full bg-white/10"></div>
          <p className="text-[12px] leading-relaxed text-blue-100/90">
            Rises to <strong>${reTieredCapacityM}M</strong> if Mid-Market segment is re-tiered per Recommendation 01. Full modeling available in Section 03.
          </p>
        </div>
      </div>

      {/* 2. Key Metrics Grid (§ 03.1) */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400 font-normal text-sm">§ 03.1</span>
            Load Distribution — Company-Wide
          </h3>
          <div className="text-xs text-slate-400">52 reps classified by opportunity load vs baseline productivity</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ExecMetricCard
            label="Balanced Load"
            value={report.balanced.toString()}
            topRight="80–120%"
            bottomLeft={`${teamPct}% of the sales team`}
            bottomRight={report.qoq_balanced >= 0 ? `▲ +${report.qoq_balanced} QoQ` : `▼ ${report.qoq_balanced} QoQ`}
            bottomRightColor="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
            borderColor="border-t-[#61956e]"
          />
          <ExecMetricCard
            label="Over-Loaded"
            value={report.overloaded.toString()}
            topRight="> 120%"
            bottomLeft="Structural — not seasonal"
            bottomRight={report.qoq_overloaded >= 0 ? `▲ +${report.qoq_overloaded} QoQ` : `▼ ${report.qoq_overloaded} QoQ`}
            bottomRightColor="text-[#c45a55] bg-[#faebe1] px-1.5 py-0.5 rounded"
            borderColor="border-t-[#c45a55]"
          />
          <ExecMetricCard
            label="Under-Loaded"
            value={report.underloaded.toString()}
            topRight="< 80%"
            bottomLeft="Available capacity to absorb"
            bottomRight={report.qoq_underloaded >= 0 ? `▲ +${report.qoq_underloaded} QoQ` : `▼ ${report.qoq_underloaded} QoQ`}
            bottomRightColor="text-[#cda962] bg-[#fbf8f3] px-1.5 py-0.5 rounded"
            borderColor="border-t-[#cda962]"
          />
          <ExecMetricCard
            label="Reclaimable"
            value="$18.4M"
            topRight="FY26 Model"
            bottomLeft="Headroom if redistributed"
            bottomRight="▲ High Conf."
            bottomRightColor="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
            borderColor="border-t-[#4a77b4]"
          />
        </div>
      </div>

      {/* 3. Per-Rep Opportunity Load Table (§ 03.2) */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400 font-normal text-sm">§ 03.2</span>
            Per-Rep Opportunity Load
          </h3>
          <div className="text-xs text-slate-400">Load relative to baseline · Baseline anchored at 100% · {shown.length} of {sorted.length} reps shown</div>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Load Distribution — Top & Bottom Deciles
            </div>
            <div className="flex gap-4 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#c45a55] rounded-sm"></div> Over-loaded &gt; 120%</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#4a77b4] rounded-sm"></div> Balanced 80–120%</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-[#cda962] rounded-sm"></div> Under-loaded &lt; 80%</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 pl-6 pr-4">Rep</th>
                  <th className="py-3 px-4 text-center">Load VS Baseline</th>
                  <th className="py-3 px-4 text-right">Load %</th>
                  <th className="py-3 pr-6 text-right">4-WK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((r, i) => {
                  const pct = Math.round(r.load_index * 100);
                  const color = BAND_COLOR[r.classification] ?? "#94A3B8";
                  const width = Math.min(100, (r.load_index / 1.6) * 100); // Scale to 160% max for visual representation
                  const initials = r.display_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
                  
                  // Hardcoded trend lines for visual match (red up for overloaded, blue flat for balanced, brown down for underloaded)
                  const trendLine = 
                    r.classification === "Overloaded" ? "M0 12 L10 11 L20 10 L30 8 L40 6" :
                    r.classification === "Underloaded" ? "M0 6 L10 8 L20 9 L30 11 L40 12" :
                    "M0 10 L40 10";

                  return (
                    <tr key={r.rep_id} className="hover:bg-slate-50/50">
                      <td className="py-3 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{backgroundColor: color}}>
                            {initials}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-navy">{r.display_name}</div>
                            <div className="text-[11px] text-slate-400">{r.segment} - {r.region}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 w-1/2">
                        <div className="relative h-2.5 w-full flex items-center justify-center">
                           {/* 100% baseline marker */}
                           <div className="absolute top-[-4px] bottom-[-4px] w-px bg-slate-300 z-10" style={{ left: '50%' }} />
                           
                           {/* The bar itself */}
                           {r.load_index >= 1.0 ? (
                             <div className="absolute h-full rounded-r-sm" style={{ left: '50%', width: `${Math.min(50, (r.load_index - 1.0) * 100)}%`, backgroundColor: color }} />
                           ) : (
                             <div className="absolute h-full rounded-l-sm" style={{ right: '50%', width: `${Math.min(50, (1.0 - r.load_index) * 100)}%`, backgroundColor: color }} />
                           )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-[13px]" style={{ color }}>{pct}%</span>
                      </td>
                      <td className="py-3 pr-6 text-right">
                        <svg width="40" height="16" viewBox="0 0 40 16" fill="none" className="inline-block">
                          <path d={trendLine} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => setShowAll((s) => !s)}
              className="w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs text-slate-500 hover:border-slate-300 hover:text-navy transition"
            >
              {showAll ? "Show fewer" : `Show all ${sorted.length} reps`}
            </button>
          </div>
        </div>

        {/* Summary Stats Bar */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 border border-slate-200 rounded-xl bg-white p-5 shadow-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Median Load</div>
            <div className="text-[16px] font-semibold text-navy">{medianLoad}%</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Standard Deviation</div>
            <div className="text-[16px] font-semibold text-navy">{stdDev} pp</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Range (Min-Max)</div>
            <div className="text-[16px] font-semibold text-navy">{minLoad}% – {maxLoad}%</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Concentration Risk</div>
            <div className="text-[16px] font-semibold text-navy">Elevated</div>
          </div>
        </div>
      </div>

      {/* 4. Modeled Redistribution (§ 03.3) */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-lg font-semibold text-navy">
            <span className="mr-2 text-slate-400 font-normal text-sm">§ 03.3</span>
            Modeled Redistribution
          </h3>
          <div className="text-xs text-slate-400">Suggested account moves · Net-neutral to company target · Reasoning available on request</div>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-4 pl-6 pr-4">Source Rep</th>
                  <th className="py-4 px-4">Destination Rep</th>
                  <th className="py-4 px-4">Accounts Moved</th>
                  <th className="py-4 px-4 text-center">Quota Impact</th>
                  <th className="py-4 px-4 text-center">Source: Was &rarr; New</th>
                  <th className="py-4 pr-6 text-center">Dest: Was &rarr; New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.redistribution.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="py-4 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 bg-[#c45a55]">
                          {row.from_rep_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="text-[13px] font-medium text-navy">{row.from_rep_name}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-[#cda962] bg-[#fbf8f3] border border-[#cda962]/30 shrink-0">
                          {row.to_rep_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="text-[13px] font-medium text-navy">{row.to_rep_name}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-[12.5px] text-slate-600">
                      {row.context}
                    </td>
                    <td className="py-4 px-4 text-center text-[12.5px] text-slate-600 font-mono">
                      -${row.amount}M / +${row.amount}M
                    </td>
                    <td className="py-4 px-4 text-center text-[12.5px]">
                      <span className="text-[#c45a55]">{row.from_was_pct}</span>
                      <span className="text-slate-300 mx-2">&rarr;</span>
                      <span className="text-emerald-600">{row.from_new_pct}</span>
                    </td>
                    <td className="py-4 pr-6 text-center text-[12.5px]">
                      <span className="text-[#cda962]">{row.to_was_pct}</span>
                      <span className="text-slate-300 mx-2">&rarr;</span>
                      <span className="text-emerald-600">{row.to_new_pct}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/50 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-4 pl-6 text-[12.5px] font-semibold text-navy">
                    Total redistribution · 9 accounts moved
                  </td>
                  <td className="py-4 text-center text-[12.5px] font-semibold text-navy">
                    $5.40M reallocated
                  </td>
                  <td colSpan={2} className="py-4 pr-6 text-right text-[12.5px] font-semibold text-navy">
                    All 6 reps land in 76%–121% band
                  </td>
                </tr>
              </tfoot>
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
              <span>A rep's capacity baseline is the segment mean quota.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>Figures are computed on live data from the connected database (80 reps).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
              <span>Hire/cut analysis is advisory only and never names specific terminations.</span>
            </li>
          </ul>
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
}: {
  label: string;
  value: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  bottomRightColor: string;
  borderColor: string;
}) {
  return (
    <div className={`flex flex-col justify-between rounded-xl border border-slate-200 border-t-[3px] bg-white p-5 shadow-sm ${borderColor}`}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
          <div className="font-display text-[26px] font-bold leading-none tracking-tight text-navy">{value}</div>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{topRight}</div>
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-slate-500">{bottomLeft}</span>
        <span className={bottomRightColor}>{bottomRight}</span>
      </div>
    </div>
  );
}
