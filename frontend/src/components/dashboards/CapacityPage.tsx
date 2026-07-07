import { useState } from "react";
import { fmtMoney, type CapacityReport } from "../../api";
import { Avatar, ExportButton, FindingsCard, Metric, PageHeader, SectionHead, StatStrip } from "../Shared";

const BAND_COLOR: Record<string, string> = {
  Overloaded: "#EF4444",
  Balanced: "#22C55E",
  Underloaded: "#F59E0B",
};

// Static Capacity Overview dashboard — per-rep load computed from the report endpoint.
export default function CapacityPage({ report }: { report: CapacityReport }) {
  const [showAll, setShowAll] = useState(false);

  const teamPct = report.rep_count ? Math.round((report.balanced / report.rep_count) * 100) : 0;
  const sorted = [...report.per_rep].sort((a, b) => b.load_index - a.load_index);
  const maxScale = Math.max(1.5, ...sorted.map((r) => r.load_index));
  const shown = showAll ? sorted : sorted.slice(0, 12);
  const refLeft = (1 / maxScale) * 100; // position of the 100% baseline line

  const actions = <ExportButton data={report} filename="capacity-overview" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Capacity Overview"
        sub="Team-wide capacity, per-rep load, and redistribution scenarios"
        actions={actions}
      />

      <StatStrip>
        <Metric label="Balanced" value={`${report.balanced} reps`} tone="good" sub={`${teamPct}% of team`} />
        <Metric
          label="Over-loaded"
          value={`${report.overloaded} reps`}
          tone="danger"
          flagged={report.overloaded > 0}
          sub="Carrying above the sustainable ceiling"
        />
        <Metric
          label="Under-loaded"
          value={`${report.underloaded} reps`}
          tone="warn"
          flagged={report.underloaded > 0}
          sub="Room to absorb more quota"
        />
        <Metric
          label="Additional Headroom"
          value={fmtMoney(report.team_additional_capacity)}
          tone="accent"
          sub="If redistributed"
        />
      </StatStrip>

      <div className="card p-4">
        <SectionHead
          title="Per-rep opportunity load"
          desc="Bar shows load relative to the segment baseline. The line at 100% is the expected load."
        />

        <div className="space-y-2.5">
          {shown.map((r) => {
            const pct = Math.round(r.load_index * 100);
            const width = Math.min(100, (r.load_index / maxScale) * 100);
            const color = BAND_COLOR[r.classification] ?? "#94A3B8";
            return (
              <div key={r.rep_id} className="flex items-center gap-3">
                <Avatar name={r.display_name} />
                <span className="w-32 shrink-0 truncate text-[12.5px] font-medium text-navy" title={r.display_name}>
                  {r.display_name}
                </span>
                <div className="relative h-4 flex-1 rounded bg-slate-100">
                  <div className="h-4 rounded" style={{ width: `${width}%`, background: color }} />
                  <div className="absolute top-[-3px] bottom-[-3px] w-px bg-slate-300" style={{ left: `${refLeft}%` }} />
                </div>
                <span
                  className="w-12 shrink-0 text-right font-display text-[13px] font-bold tabular-nums"
                  style={{ color }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>

        {sorted.length > 12 && (
          <button
            onClick={() => setShowAll((s) => !s)}
            className="mt-3 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs text-slatebody hover:border-brand hover:text-brand-dark"
          >
            {showAll ? "Show fewer" : `Show all ${sorted.length} reps`}
          </button>
        )}

        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[11px] text-slatebody">
          <Legend color={BAND_COLOR.Overloaded} label="Over-loaded" />
          <Legend color={BAND_COLOR.Balanced} label="Balanced" />
          <Legend color={BAND_COLOR.Underloaded} label="Under-loaded" />
        </div>
      </div>

      <FindingsCard findings={report.findings} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
