import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney, type AgentRunResponse, type QuotaEquityReport } from "../api";
import DataTable, { type Column } from "./DataTable";
import Heatmap from "./Heatmap";
import Markdown from "./Markdown";
import { Avatar, CHART_TOOLTIP, FindingsCard, Metric, SectionHead, StatStrip } from "./Shared";

export default function QuotaEquityView({
  run,
  hideNarrative,
}: {
  run: AgentRunResponse;
  hideNarrative?: boolean;
}) {
  const r = run.report as QuotaEquityReport;
  const bandCounts = ["Underloaded", "Equitable", "Stretched", "Overloaded"].map((b) => ({
    band: b,
    count: r.heatmap.filter((c) => c.band === b).length,
    color: r.heatmap.find((c) => c.band === b)?.color ?? "#94a3b8",
  }));

  // band -> color (per_rep rows don't carry a color, the heatmap cells do)
  const bandColor: Record<string, string> = {};
  for (const c of r.heatmap) bandColor[c.band] = c.color;

  const outliers = [...r.per_rep].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  const outlierCols: Column[] = [
    {
      key: "display_name",
      label: "Rep",
      render: (row) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <Avatar name={String(row.display_name)} />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{String(row.display_name)}</span>
              <span className="font-mono text-[10px] text-slate-400">{String(row.rep_id)}</span>
            </div>
            <div className="text-[11px] text-slate-400">{String(row.email)}</div>
          </div>
        </div>
      ),
    },
    { key: "segment", label: "Segment", className: "text-slatebody" },
    {
      key: "fairness_ratio",
      label: "Fairness ratio",
      align: "right",
      render: (row) => Number(row.fairness_ratio).toFixed(3),
    },
    {
      key: "deviation",
      label: "Deviation",
      align: "right",
      render: (row) => {
        const d = Number(row.deviation);
        return <span className={d > 0 ? "text-band-overloaded" : "text-band-under"}>{(d * 100).toFixed(0)}%</span>;
      },
    },
    {
      key: "band",
      label: "Band",
      render: (row) => (
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: bandColor[String(row.band)] ?? "#94a3b8" }}
        >
          {String(row.band)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Deployed vs target callout */}
      <div className="card card-hover p-4">
        <SectionHead
          title="Deployed Quota vs Top-Down Target"
          desc="Deployed quota is the sum of every rep's quota; the top-down target is the company goal. They are different numbers — a gap (≠) means the field is carrying more (or less) quota than the plan."
        />
        <StatStrip>
          <Metric label="Deployed quota" value={fmtMoney(r.deployed_quota)} tone="accent" />
          <Metric label="Top-down target" value={fmtMoney(r.top_down_target)} />
          <Metric
            label="Over-assignment"
            value={`${fmtMoney(r.over_assignment)} (${r.over_assignment_pct.toFixed(1)}%)`}
            tone={parseFloat(r.over_assignment) > 0 ? "danger" : "good"}
          />
          <Metric label="Reps analyzed" value={String(r.rep_count)} />
        </StatStrip>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card card-hover p-4 lg:col-span-2">
          <SectionHead
            title="Quota Fairness Heatmap"
            desc="Each square is one rep, grouped by segment and colored by how their quota compares to their territory's opportunity: blue = underloaded, green = fair, amber = stretched, red = overloaded. Click a square to see that rep's numbers."
          />
          <Heatmap report={r} />
        </div>
        <div className="card card-hover p-4">
          <SectionHead
            title="Fairness Distribution"
            desc="The bars show how many reps fall in each fairness band. Below, each segment's quota spread (CV = coefficient of variation): a value near 0.000 means everyone got the same quota — 'paintbrushed'."
          />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={bandCounts} margin={{ top: 6, right: 6, bottom: 5, left: -18 }}>
              <CartesianGrid vertical={false} stroke="#EAEEF6" />
              <XAxis dataKey="band" tick={{ fontSize: 10, fill: "#5A5A77" }} interval={0} tickLine={false} axisLine={{ stroke: "#E2E7F1" }} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8AA6" }} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <Tooltip cursor={{ fill: "rgba(33,30,86,0.04)" }} contentStyle={CHART_TOOLTIP} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={46}>
                {bandCounts.map((b) => (
                  <Cell key={b.band} fill={b.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slatebody">
            {r.segments.map((s) => (
              <div key={s.segment} className="flex items-center justify-between">
                <span>{s.segment}</span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono">CV {s.quota_cv.toFixed(3)}</span>
                  {s.is_paintbrushed && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      PAINTBRUSH
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outlier list */}
      <div className="card card-hover p-4">
        <SectionHead
          title="Fairness Outliers (largest deviation)"
          desc="The reps furthest from their segment's median. Deviation is how far their quota-to-opportunity ratio sits from the norm — a big positive % (red) means they carry far more quota than peers with similar pipeline."
        />
        <DataTable
          columns={outlierCols}
          rows={outliers as unknown as Record<string, unknown>[]}
          initial={8}
          getKey={(row) => String(row.rep_id)}
        />
      </div>

      {/* Findings */}
      <FindingsCard findings={r.findings} />

      {/* Reasoning narrative */}
      {!hideNarrative && (
        <div className="card card-hover p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="panel-title">Reasoning Narrative</div>
            <span className="text-[11px] text-slatebody">
              via {run.narrative_source} · hash {run.determinism_hash.slice(0, 10)}
            </span>
          </div>
          <Markdown source={run.narrative} />
        </div>
      )}
    </div>
  );
}
