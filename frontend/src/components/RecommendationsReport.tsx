import { type ReactNode, useEffect, useState } from "react";
import { api, fmtMoney, type Assumption, type RecommendationItem, type RecommendationsResponse } from "../api";

// Spell out small counts ("four interventions"); fall back to the digit for larger numbers.
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve",
];
function numberToWords(n: number): string {
  return n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
}

type Priority = "Critical" | "Priority" | "Standard";

const PRIORITY_STYLE: Record<Priority, { band: string; text: string }> = {
  Critical: { band: "bg-red-400", text: "text-red-50" },
  Priority: { band: "bg-amber-500/90", text: "text-amber-50" },
  Standard: { band: "bg-blue-500/90", text: "text-blue-50" },
};

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </span>
  );
}

function titleCase(id: string): string {
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function confidenceRail(confidence: string): string {
  const high = confidence.toLowerCase() === "high";
  return `${high ? "▲" : "●"} ${confidence}`;
}

// Recommendations section (§ 04) — prioritized actions from the recommendations dashboard.
export default function RecommendationsReport({ role }: { role: string }) {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setErr(null);
    api
      .recommendations(role)
      .then(setData)
      .catch((ex) => setErr(String(ex)));
  }, [role]);

  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>;
  if (!data)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Loading recommendations…
      </div>
    );

  const roleName = role.charAt(0).toUpperCase() + role.slice(1);
  const fy = `FY${String(new Date().getFullYear()).slice(2)}`;
  const recs = data.recommendations;
  const assumptions = data.assumptions;
  const paintSeg = data.paintbrush_segment;

  return (
    <div className="space-y-8 pb-4">
      {/* § 04 headline */}
      <section className="grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[1fr_300px]">
        <div className="p-6 md:p-8 lg:pr-12">
          <div className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#3b75c4]">
            Recommendations
            <span className="rounded bg-[#edf4fc] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#3b75c4]">§ 04</span>
          </div>
          <h2 className="mt-3 font-display text-[22px] font-semibold leading-snug tracking-tight text-navy max-w-2xl">
            <span className="capitalize">{numberToWords(recs.length)}</span> intervention
            {recs.length === 1 ? "" : "s"} can restore fairness across the {fy} plan and reclaim{" "}
            {fmtMoney(data.aggregate_impact)} in addressable impact.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500 max-w-2xl">
            Recommendations are ranked by expected impact and require {roleName}'s approval for enactment.
            {paintSeg && ` HR alignment is required for the ${paintSeg} re-tiering.`} Full assumptions and
            limitations are set out in § 04.2.
          </p>
        </div>

        <div className="flex flex-col justify-between bg-[#2d5793] p-6 md:p-8 text-white">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Aggregate Impact</div>
            <div className="mt-4 font-display text-[44px] font-extrabold leading-none tracking-tight text-white">
              {fmtMoney(data.aggregate_impact)}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/70">
              Addressable across {numberToWords(recs.length)} recommendation{recs.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="mt-6 border-t border-white/20 pt-4 text-[11.5px] leading-relaxed text-white/60">
            {data.has_redistribution
              ? "The redistribution is executable in days with no HR involvement; re-segmentation requires HR alignment first."
              : "Effort and timeline are planning estimates; enactment requires owner approval."}
          </div>
        </div>
      </section>

      {/* § 04.1 Recommendation cards */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 04.1</span>
            Recommendations for Management Review
          </h3>
          <span className="text-[11px] text-slate-400">
            Ranked by expected impact · requires {roleName} approval
          </span>
        </div>

        <div className="space-y-3.5">
          {recs.map((r, i) => (
            <RecommendationCard key={r.code} rec={r} index={i} />
          ))}
        </div>
      </section>

      {/* § 04.2 Assumptions and limitations */}
      {assumptions.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
              <span className="mr-2 font-mono text-[12px] text-slate-400">§ 04.2</span>
              Assumptions and Limitations
            </h3>
            <span className="text-[11px] text-slate-400">Applied to the recommendations above</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between border-b border-slate-100 pb-3">
              <span className="font-display text-[13.5px] font-bold text-navy">Analytical Basis · {fy} Plan Review</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {assumptions.length} assumptions · applied throughout
              </span>
            </div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {assumptions.map((a) => (
                <AssumptionRow key={a.id} assumption={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function RecommendationCard({ rec, index }: { rec: RecommendationItem; index: number }) {
  const priority = rec.priority as Priority;
  const st = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.Standard;
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`flex w-16 shrink-0 flex-col items-center justify-center gap-1 ${st.band} ${st.text}`}>
        <span className="font-display text-[22px] font-extrabold leading-none tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-[8.5px] font-bold uppercase tracking-[0.1em]">{rec.priority}</span>
      </div>

      <div className="min-w-0 flex-1 p-4">
        <h4 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-navy">{rec.title}</h4>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500">{rec.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rec.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      </div>

      <div className="hidden w-40 shrink-0 flex-col justify-center gap-3 border-l border-slate-100 bg-slate-50/50 p-4 sm:flex">
        <RailStat label="Est. Impact" value={fmtMoney(rec.impact)} accent />
        <RailStat label="Effort" value={rec.effort} />
        <RailStat label="Confidence" value={confidenceRail(rec.confidence)} />
      </div>
    </div>
  );
}

function AssumptionRow({ assumption }: { assumption: Assumption }) {
  return (
    <div className="text-[12.5px] leading-relaxed text-slate-500">
      <span className="font-semibold text-navy">§ {titleCase(assumption.id)}.</span> {assumption.statement}
    </div>
  );
}

function RailStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div
        className={`mt-0.5 font-display text-[15px] font-bold tabular-nums ${accent ? "text-flag-text" : "text-navy"}`}
      >
        {value}
      </div>
    </div>
  );
}
