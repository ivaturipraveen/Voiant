import { type RecommendationsReport } from "../../api";

export default function RecommendationsPage({ report }: { report: RecommendationsReport }) {
  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. Headline Block */}
      <div className="flex flex-col md:flex-row overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 p-8 md:p-10 lg:pr-32 xl:pr-48">
          <div className="mb-4 flex items-center gap-2.5 text-[10px] font-bold tracking-widest uppercase">
            <span className="text-[#4a77b4]">RECOMMENDATIONS</span>
            <span className="rounded bg-[#eef4fa] px-1.5 py-0.5 text-[#4a77b4]">§ 04</span>
          </div>
          <h2 className="mb-4 font-display text-[22px] font-semibold leading-snug text-navy lg:pr-12 xl:pr-20">
            Three interventions can restore fairness across the FY26 plan, reclaim {report.aggregate_impact} in effective headroom, and unlock $8.6M of stalled Strategic pipeline.
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500 lg:pr-8 xl:pr-16">
            Recommendations are ranked by expected impact and require Sarah Coleman's approval for enactment.<br className="hidden md:block" />HR alignment is required for Recommendation 01 (Mid-Market re-tiering). Full assumptions and limitations are set out in § 4.2.
          </p>
        </div>
        
        <div className="flex w-full flex-col justify-center bg-[#355b85] p-8 text-white md:w-80 md:shrink-0 lg:w-[340px]">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-200/80">AGGREGATE IMPACT</div>
          <div className="mb-2 font-display text-[42px] font-bold leading-none tracking-tight">{report.aggregate_impact}</div>
          <div className="mb-6 text-[10px] text-blue-100/90">Reclaimable across three recommendations</div>
          
          <div className="border-t border-white/20 pt-5 text-[11px] leading-[1.6] text-blue-50/90">
            <span className="font-semibold text-white">3 weeks</span> to full implementation. Recommendation 02 (redistribution) is executable in <span className="font-semibold text-white">3 days</span> with no HR involvement.
          </div>
        </div>
      </div>

      {/* 2. Recommendations for Management Review */}
      <div>
        <div className="mb-4 flex items-end justify-between px-2">
          <h3 className="font-display text-lg font-medium text-navy">
            <span className="mr-2 text-slate-400">§ 04.1</span> Recommendations for Management Review
          </h3>
          <div className="text-[11px] text-slate-400">
            Ranked by expected impact · Requires Sarah Coleman approval
          </div>
        </div>
        
        <div className="space-y-4">
          
          {report.cards.map((card) => {
            return (
              <div key={card.id} className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex w-16 shrink-0 flex-col items-center justify-center p-3 text-white" style={{ backgroundColor: card.priority_color }}>
                  <span className="font-display text-xl font-bold">{card.priority_num}</span>
                  <span className="mt-1 text-[8px] font-bold uppercase tracking-wider text-center leading-tight">{card.priority_label}</span>
                </div>
                <div className="flex flex-1 flex-col justify-between p-6 md:flex-row md:items-start md:gap-8">
                  <div className="flex-1">
                    <h4 className="mb-3 text-[17px] font-semibold text-navy">
                      {card.title}
                    </h4>
                    <p className="mb-4 text-[13px] leading-relaxed text-slate-600">
                      {card.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {card.tags.map((t, idx) => {
                        let colorClass = "bg-slate-100 text-slate-600";
                        if (t.color_scheme === "amber") colorClass = "bg-amber-50 text-amber-700";
                        if (t.color_scheme === "emerald") colorClass = "bg-emerald-50 text-emerald-700";
                        return (
                          <span key={idx} className={`rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                            {t.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-6 flex shrink-0 gap-8 md:mt-0 md:flex-col md:gap-4 md:text-right">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">EST. IMPACT</div>
                      <div className="font-display text-xl font-bold text-navy">{card.impact_dollars}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">EFFORT</div>
                      <div className="text-[13px] font-semibold text-navy">{card.effort}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">CONFIDENCE</div>
                      <div className="flex items-center gap-1.5 md:justify-end text-[13px] font-medium" style={{ color: card.priority_color === '#4a77b4' ? '#cda962' : '#047857' }}>
                        <span className="text-[10px]">{card.confidence_icon}</span> {card.confidence_level}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
        </div>
      </div>
      
      {/* 3. Assumptions and Limitations */}
      <div className="pt-4">
        <div className="mb-4 flex items-end justify-between px-2">
          <h3 className="font-display text-lg font-medium text-navy">
            <span className="mr-2 text-slate-400">§ 04.2</span> Assumptions and Limitations
          </h3>
          <div className="text-[11px] text-slate-400">
            Applied to the recommendations above
          </div>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="text-[13px] font-semibold text-navy">
              Analytical Basis · FY26 Plan Review
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              6 ASSUMPTIONS · APPLIED THROUGHOUT
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ TAM basis.</span> Total Addressable Market derived from Salesforce Territory Object as of {report.snapshot_date_str}. Whitespace accounts weighted at 40% per {report.client_name} client rules.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ Federal exclusion.</span> The {report.company_target_str} company target excludes the Federal segment, which is tracked and compensated separately.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ Territory Q4 boarding.</span> Reps who joined after 1 October 2025 receive prorated quotas and are excluded from fairness classification.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ Baseline productivity.</span> Load baseline uses 3-year rolling median deal velocity and win rate by segment.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ Compensation neutrality.</span> All redistribution recommendations assume no change to individual rep OTE. Where re-segmentation implies OTE change, recommendation flagged for HR review.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-navy">§ Data recency.</span> Analysis reflects data as-of {report.snapshot_date_str}. Refresh cadence: {report.refresh_cadence}.
              </p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
