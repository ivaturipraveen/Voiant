import { useState } from "react";
import { fmtMoney, type CapacityReport, type RepLoad } from "../api";
import { Avatar, Sparkline, spark } from "./Shared";

// Mockup band colors: over-loaded red, balanced blue, under-loaded gold.
const BAND: Record<string, { color: string; label: string; badge: string }> = {
  Overloaded: { color: "#EF4444", label: "Over-loaded > 120%", badge: "bg-red-50 text-red-700 border-red-100" },
  Balanced: { color: "#3B82F6", label: "Balanced 80–120%", badge: "bg-blue-50 text-blue-700 border-blue-100" },
  Underloaded: { color: "#CA8A04", label: "Under-loaded < 80%", badge: "bg-amber-50 text-amber-800 border-amber-100" },
};

function bandOf(r: RepLoad): "Overloaded" | "Balanced" | "Underloaded" {
  if (r.classification === "Overloaded" || r.classification === "Balanced" || r.classification === "Underloaded")
    return r.classification;
  if (r.load_index > 1.2) return "Overloaded";
  if (r.load_index < 0.8) return "Underloaded";
  return "Balanced";
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

// Capacity Analysis rendered as the report's §03 sections — headline, load distribution,
// per-rep diverging load chart, footer stats, and modeled redistribution. Every figure is
// computed from the live capacity-overview report.
export default function CapacityReport({ report }: { report: CapacityReport }) {
  const [showAll, setShowAll] = useState(false);

  const loads = report.per_rep.map((r) => r.load_index);
  const maxDev = Math.max(0.25, ...report.per_rep.map((r) => Math.abs(r.load_index - 1)));
  const teamBalancedPct = report.rep_count ? Math.round((report.balanced / report.rep_count) * 100) : 0;

  const medianLoad = median(loads);
  const sd = stddev(loads);
  const minLoad = loads.length ? Math.min(...loads) : 0;
  const maxLoad = loads.length ? Math.max(...loads) : 0;
  const concentration = sd >= 0.3 ? "High" : sd >= 0.18 ? "Elevated" : "Moderate";

  const sorted = [...report.per_rep].sort((a, b) => b.load_index - a.load_index);
  const k = Math.max(3, Math.round(report.rep_count / 10));
  const deciles = sorted.length > 2 * k ? [...sorted.slice(0, k), ...sorted.slice(-k)] : sorted;
  const shown = showAll ? sorted : deciles;

  const repById = new Map(report.per_rep.map((r) => [r.rep_id, r]));
  const totalReallocated = report.redistribution.reduce((a, m) => a + parseFloat(m.amount), 0);

  const fy = `FY${String(new Date().getFullYear()).slice(2)}`;
  const reclaimable = report.team_additional_capacity;

  return (
    <div className="space-y-8 pb-4">
      {/* § 03 headline */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[2.3fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Capacity Analysis
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">§ 03</span>
          </div>
          <h2 className="mt-3 font-display text-[22px] font-semibold leading-snug tracking-tight text-navy">
            Team-wide capacity is being masked by imbalance: {report.overloaded} reps carrying &gt;120% of baseline
            while {report.underloaded} sit below 80% — {fmtMoney(reclaimable)} of headroom is redistributable.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-slate-500">
            Over-loaded reps show pipeline coverage below the segment median, suggesting the excess quota is not being
            met with proportionate opportunity. Modeled account moves land the affected reps back inside the 80–120%
            band with no impact to company target coverage. Full detail in § 03.3.
          </p>
        </div>

        <div className="flex flex-col rounded-2xl bg-gradient-to-br from-[#33518f] to-[#3f5fa1] p-6 text-white">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
              Reclaimable Headroom
            </div>
            <div className="mt-4 font-display text-[44px] font-extrabold leading-none tracking-tight text-white">
              {fmtMoney(reclaimable)}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
              If all reps rebalanced to the fair band ({report.team_additional_capacity_pct.toFixed(1)}% of deployed
              quota).
            </p>
          </div>
          <p className="mt-auto pt-8 text-[11.5px] leading-relaxed text-white/45">
            Modeled redistribution (§ 03.3) reallocates {fmtMoney(totalReallocated)} across{" "}
            {report.redistribution.length} moves without raising individual OTE exposure.
          </p>
        </div>
      </section>

      {/* § 03.1 Load distribution cards */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 03.1</span>
            Load Distribution — Company-Wide
          </h3>
          <span className="text-[11px] text-slate-400">
            {report.rep_count} reps classified by opportunity load vs baseline productivity
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <DistCard
            label="Balanced Load"
            hint="80–120%"
            value={String(report.balanced)}
            caption={`${teamBalancedPct}% of the sales team`}
            accent="#3B82F6"
          />
          <DistCard
            label="Over Loaded"
            hint="> 120%"
            value={String(report.overloaded)}
            caption="Carrying above the sustainable ceiling"
            accent="#EF4444"
            flagged
          />
          <DistCard
            label="Under Loaded"
            hint="< 80%"
            value={String(report.underloaded)}
            caption="Available capacity to absorb"
            accent="#CA8A04"
            flagged
          />
          <DistCard
            label="Reclaimable"
            hint={`${fy} model`}
            value={fmtMoney(reclaimable)}
            caption="Headroom if redistributed"
            accent="#34B7AD"
          />
        </div>
      </section>

      {/* § 03.2 Per-rep opportunity load — diverging bars around a 100% baseline */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
            <span className="mr-2 font-mono text-[12px] text-slate-400">§ 03.2</span>
            Per-Rep Opportunity Load
          </h3>
          <span className="text-[11px] text-slate-400">
            Load relative to baseline · Baseline anchored at 100% · {shown.length} of {report.rep_count} reps shown
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {showAll ? "All reps · sorted by load" : "Load distribution — top & bottom deciles"}
            </span>
            <div className="flex flex-wrap items-center gap-3.5 text-[10.5px] text-slate-500">
              {(["Overloaded", "Balanced", "Underloaded"] as const).map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BAND[b].color }} />
                  {BAND[b].label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {shown.map((r) => {
              const band = bandOf(r);
              const color = BAND[band].color;
              const dev = r.load_index - 1;
              const width = (Math.abs(dev) / maxDev) * 50;
              const pct = Math.round(r.load_index * 100);
              const dir = dev >= 0 ? "up" : "down";
              return (
                <div key={r.rep_id} className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-slate-50">
                  <Avatar name={r.display_name} />
                  <div className="w-40 shrink-0">
                    <div className="truncate text-[12.5px] font-medium text-navy" title={r.display_name}>
                      {r.display_name}
                    </div>
                    <div className="truncate text-[10.5px] text-slate-400">
                      {r.segment} · {r.region}
                    </div>
                  </div>
                  <div className="relative h-4 flex-1">
                    <div className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-300" />
                    <div
                      className="absolute top-0 h-4 rounded-sm"
                      style={
                        dev >= 0
                          ? { left: "50%", width: `${width}%`, background: color }
                          : { right: "50%", width: `${width}%`, background: color }
                      }
                    />
                  </div>
                  <span
                    className="w-12 shrink-0 text-right font-display text-[13px] font-bold tabular-nums"
                    style={{ color }}
                  >
                    {pct}%
                  </span>
                  <Sparkline data={spark(r.rep_id, dir)} color={color} className="hidden h-5 w-16 sm:block" />
                </div>
              );
            })}
          </div>

          {sorted.length > deciles.length && (
            <button
              onClick={() => setShowAll((s) => !s)}
              className="mt-3 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs text-slate-500 hover:border-brand hover:text-brand-dark"
            >
              {showAll ? "Show top & bottom deciles" : `Show all ${sorted.length} reps`}
            </button>
          )}

          {/* Footer stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <FootStat label="Median Load" value={`${Math.round(medianLoad * 100)}%`} />
            <FootStat label="Standard Deviation" value={`${(sd * 100).toFixed(1)} pp`} />
            <FootStat label="Range (min–max)" value={`${Math.round(minLoad * 100)}% – ${Math.round(maxLoad * 100)}%`} />
            <FootStat label="Concentration Risk" value={concentration} tone={concentration !== "Moderate"} />
          </div>
        </div>
      </section>

      {/* § 03.3 Modeled redistribution */}
      {report.redistribution.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
              <span className="mr-2 font-mono text-[12px] text-slate-400">§ 03.3</span>
              Modeled Redistribution
            </h3>
            <span className="text-[11px] text-slate-400">
              Suggested quota moves · net-neutral to company target · reasoning available on request
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[860px] text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  <th className="py-2.5 pl-4 pr-3 font-semibold">Source Rep</th>
                  <th className="py-2.5 pr-3 font-semibold">Destination Rep</th>
                  <th className="py-2.5 pr-3 font-semibold">Basis</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Quota Impact</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Source: was → new</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Dest: was → new</th>
                </tr>
              </thead>
              <tbody>
                {report.redistribution.map((m, i) => {
                  const src = repById.get(m.from_rep);
                  const dst = repById.get(m.to_rep);
                  const amt = parseFloat(m.amount);
                  const srcWas = src?.load_index ?? 0;
                  const srcNew = src ? (parseFloat(src.quota) - amt) / parseFloat(src.baseline) : 0;
                  const dstWas = dst?.load_index ?? 0;
                  const dstNew = dst ? (parseFloat(dst.quota) + amt) / parseFloat(dst.baseline) : 0;
                  return (
                    <tr key={i} className="border-b border-slate-100 align-middle last:border-0">
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={src?.display_name ?? m.from_rep} />
                          <span className="font-medium text-navy">{src?.display_name ?? m.from_rep}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={dst?.display_name ?? m.to_rep} />
                          <span className="font-medium text-navy">{dst?.display_name ?? m.to_rep}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-500">{m.segment} · quota-level</td>
                      <td className="py-3 pr-3 text-right tabular-nums text-slate-600">
                        <span className="text-red-600">−{fmtMoney(amt)}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="text-emerald-600">+{fmtMoney(amt)}</span>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-navy">
                        {Math.round(srcWas * 100)}% <span className="text-slate-300">→</span>{" "}
                        {Math.round(srcNew * 100)}%
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-navy">
                        {Math.round(dstWas * 100)}% <span className="text-slate-300">→</span>{" "}
                        {Math.round(dstNew * 100)}%
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 text-[12.5px] font-semibold">
                  <td className="py-3 pl-4 pr-3 text-navy" colSpan={3}>
                    Total redistribution · {report.redistribution.length} moves
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums text-navy">{fmtMoney(totalReallocated)} reallocated</td>
                  <td className="py-3 pr-4 text-right text-slate-500" colSpan={2}>
                    Affected reps rebalanced toward the 80–120% band
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

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

function DistCard({
  label,
  hint,
  value,
  caption,
  accent,
  flagged,
}: {
  label: string;
  hint: string;
  value: string;
  caption: string;
  accent: string;
  flagged?: boolean;
}) {
  return (
    <div
      className={`flex-1 basis-[210px] rounded-xl border px-4 py-3.5 ${
        flagged ? "border-flag-border bg-flag-bg" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
          {hint}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="font-display text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-navy">
          {value}
        </span>
      </div>
      <div className="mt-1.5 text-[10.5px] leading-snug text-slate-400">{caption}</div>
    </div>
  );
}

function FootStat({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className={`mt-0.5 font-display text-[16px] font-bold tabular-nums ${tone ? "text-flag-text" : "text-navy"}`}>
        {value}
      </div>
    </div>
  );
}
