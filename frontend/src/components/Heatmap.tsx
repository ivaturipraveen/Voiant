import { useMemo, useState } from "react";
import type { HeatmapCell, QuotaEquityReport } from "../api";

const BAND_ORDER = ["Underloaded", "Equitable", "Stretched", "Overloaded"];

export default function Heatmap({ report }: { report: QuotaEquityReport }) {
  const [selected, setSelected] = useState<HeatmapCell | null>(null);

  const bandColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of report.heatmap) m[c.band] = c.color;
    return m;
  }, [report]);

  const bySegment = useMemo(() => {
    const m = new Map<string, HeatmapCell[]>();
    for (const c of report.heatmap) {
      const arr = m.get(c.segment) ?? [];
      arr.push(c);
      m.set(c.segment, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.deviation - a.deviation);
    return [...m.entries()];
  }, [report]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slatebody">
        <span className="font-semibold text-navy">Fairness band</span>
        {BAND_ORDER.map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded" style={{ background: bandColor[b] ?? "#ccc" }} />
            {b}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {bySegment.map(([segment, cells]) => (
          <div key={segment}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-semibold text-navy">{segment}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slatebody">
                {cells.length} reps
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {cells.map((c) => (
                <button
                  key={c.rep_id}
                  title={`${c.display_name} · ${c.band} · ${(c.deviation * 100).toFixed(0)}%`}
                  onClick={() => setSelected(selected?.rep_id === c.rep_id ? null : c)}
                  className={`h-7 w-7 rounded text-[9px] font-semibold text-white/95 transition hover:scale-110 ${
                    selected?.rep_id === c.rep_id ? "ring-2 ring-navy ring-offset-1" : ""
                  }`}
                  style={{ background: c.color }}
                >
                  {c.rep_id.replace("R", "")}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-navy">
              {selected.display_name} <span className="font-normal text-slatebody">({selected.rep_id})</span>
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ background: selected.color }}
            >
              {selected.band}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slatebody">
            <span>Segment</span>
            <span className="text-right text-ink">{selected.segment}</span>
            <span>Region</span>
            <span className="text-right text-ink">{selected.region}</span>
            <span>Fairness ratio (quota / opportunity)</span>
            <span className="text-right font-mono text-ink">{selected.fairness_ratio.toFixed(3)}</span>
            <span>Deviation vs segment median</span>
            <span className="text-right font-mono text-ink">{(selected.deviation * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slatebody">
            This rep's quota-to-opportunity ratio sits {(selected.deviation * 100).toFixed(0)}% from the{" "}
            {selected.segment} median, placing them in the <b className="text-ink">{selected.band}</b> band.
          </div>
        </div>
      )}
    </div>
  );
}
