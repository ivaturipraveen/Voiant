import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney, type AgentRunResponse, type CapacityReport } from "../api";
import DataTable, { type Column } from "./DataTable";
import { FindingsCard, Metric, NarrativeCard, SectionHead, StatStrip } from "./Shared";

export default function CapacityView({
  run,
  hideNarrative,
}: {
  run: AgentRunResponse;
  hideNarrative?: boolean;
}) {
  const r = run.report as CapacityReport;

  // Two-sided bar: load above/below baseline per rep, sorted, colored by classification.
  const bars = [...r.per_rep]
    .map((rl) => ({
      rep: rl.rep_id.replace("R", ""),
      delta: Math.round(parseFloat(rl.load_delta) / 1000), // $K
      color: rl.color,
      name: rl.display_name,
      cls: rl.classification,
    }))
    .sort((a, b) => b.delta - a.delta);

  const redistCols: Column[] = [
    { key: "from_rep", label: "From" },
    { key: "to_rep", label: "To" },
    { key: "segment", label: "Segment", className: "text-slatebody" },
    { key: "amount", label: "Move", align: "right", render: (m) => fmtMoney(String(m.amount)) },
  ];

  const rollupCols: Column[] = [
    { key: "segment", label: "Segment" },
    { key: "total_headroom", label: "Headroom", align: "right", render: (s) => fmtMoney(String(s.total_headroom)) },
    { key: "overloaded", label: "Over", align: "right", className: "text-band-overloaded", render: (s) => String(s.overloaded) },
    { key: "underloaded", label: "Under", align: "right", className: "text-band-under", render: (s) => String(s.underloaded) },
  ];

  return (
    <div className="space-y-4">
      <div className="card card-hover p-4">
        <SectionHead
          title="Team Capacity Headroom"
          desc="How much more quota the whole team could carry before reps break, plus how load is split: overloaded (carrying too much), balanced, and underloaded (has room to absorb more)."
        />
        <StatStrip>
          <Metric
            label="Additional quota the team can carry"
            value={`${fmtMoney(r.team_additional_capacity)} (${r.team_additional_capacity_pct.toFixed(1)}%)`}
            tone="accent"
          />
          <Metric label="Overloaded" value={String(r.overloaded)} tone="danger" />
          <Metric label="Balanced" value={String(r.balanced)} tone="good" />
          <Metric label="Underloaded" value={String(r.underloaded)} />
          <Metric label="Reps" value={String(r.rep_count)} />
        </StatStrip>
      </div>

      {r.scenario && (
        <div
          className={`card card-hover border-l-4 p-4 ${
            r.scenario.feasible ? "border-band-equitable" : "border-band-overloaded"
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="panel-title">What-if · {r.scenario.kind.replace(/_/g, " ")}</span>
            <span
              className={`chip ${
                r.scenario.feasible ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              } text-[10px] font-semibold uppercase`}
            >
              {r.scenario.feasible ? "Feasible" : "Risky"}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink">{r.scenario.summary}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <KeyVals title="Before" data={r.scenario.before} />
            <KeyVals title="After" data={r.scenario.after} />
          </div>
        </div>
      )}

      <div className="card card-hover p-4">
        <SectionHead
          title="Capacity by Rep (quota vs segment baseline)"
          desc="Each bar is one rep compared to their segment's baseline quota. Above the zero line (red) = overloaded and needs relief; below the line (blue) = has room to take on more."
        />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={bars} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <XAxis dataKey="rep" tick={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 10 }}
              label={{ value: "$K vs baseline", angle: -90, position: "insideLeft", style: { fontSize: 10 } }}
            />
            <Tooltip
              formatter={(v: number) => [`${v >= 0 ? "+" : ""}${v}K`, "vs baseline"]}
              labelFormatter={(l) => `Rep R${l}`}
            />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="delta" radius={[2, 2, 0, 0]}>
              {bars.map((b, i) => (
                <Cell key={i} fill={b.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slatebody">
          <Legend color="#EF4444" label="Overloaded (above baseline)" />
          <Legend color="#22C55E" label="Balanced" />
          <Legend color="#3B82F6" label="Underloaded (below baseline)" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card card-hover p-4">
          <SectionHead
            title={`Redistribution Suggestions (${r.redistribution.length})`}
            desc="Concrete moves to rebalance: shift quota from overloaded reps to reps in the same segment who have room — before spending on new headcount."
          />
          <DataTable
            columns={redistCols}
            rows={r.redistribution as unknown as Record<string, unknown>[]}
            initial={8}
            empty="No redistribution needed."
          />
        </div>
        <div className="card card-hover p-4">
          <SectionHead
            title="Segment Rollups"
            desc="Per-segment view: total headroom, and how many reps are over- vs under-loaded in each segment."
          />
          <DataTable
            columns={rollupCols}
            rows={r.rollups as unknown as Record<string, unknown>[]}
            getKey={(s) => String(s.segment)}
          />
        </div>
      </div>

      <FindingsCard findings={r.findings} />
      {!hideNarrative && (
        <NarrativeCard narrative={run.narrative} source={run.narrative_source} hash={run.determinism_hash} />
      )}
    </div>
  );
}

function KeyVals({ title, data }: { title: string; data: Record<string, string | number> }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slatebody">{title}</div>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex justify-between py-0.5 text-xs text-slatebody">
          <span className="capitalize">{k.replace(/_/g, " ")}</span>
          <span className="font-medium text-ink">{String(v).length > 9 ? fmtMoney(v) : String(v)}</span>
        </div>
      ))}
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
