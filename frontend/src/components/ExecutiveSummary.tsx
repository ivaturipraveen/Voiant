import { useEffect, useState } from "react";
import { api, type ExecutiveSummaryResponse } from "../api";
import Markdown from "./Markdown";
import { SectionHead } from "./Shared";

const TONE: Record<string, string> = {
  good: "text-green-600",
  warn: "text-amber-600",
  danger: "text-band-overloaded",
  neutral: "text-ink",
};

const SEV: Record<string, string> = {
  critical: "border-band-overloaded bg-red-50 text-red-700",
  warn: "border-band-stretched bg-amber-50 text-amber-700",
  info: "border-slate-300 bg-slate-50 text-slate-600",
};

// Cache by role so re-opening the tab is instant (no reload).
const _execCache: Record<string, ExecutiveSummaryResponse> = {};

export function clearExecCache() {
  for (const k in _execCache) delete _execCache[k];
}

export default function ExecutiveSummary({ role }: { role: string }) {
  const [data, setData] = useState<ExecutiveSummaryResponse | null>(_execCache[role] ?? null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (_execCache[role]) {
      setData(_execCache[role]);
      return;
    }
    api
      .executiveSummary(role)
      .then((d) => {
        _execCache[role] = d;
        setData(d);
      })
      .catch((e) => setErr(String(e)));
  }, [role]);

  if (err) return <div className="card p-4 text-sm text-red-700">{err}</div>;
  if (!data) return <div className="card p-8 text-center text-sm text-slatebody">Loading executive summary…</div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <SectionHead
          title="Executive Summary — top findings this week"
          desc="The headline numbers for the whole organization: deployed quota vs the target, how much spare capacity exists, and how many reps/segments have problems. Built from both agents' analysis."
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {data.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slatebody">{m.label}</div>
              <div className={`font-display text-xl font-extrabold ${TONE[m.tone] ?? TONE.neutral}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <SectionHead
          title="Top 5 findings (Quota Equity + Capacity)"
          desc="The five most important issues across both agents, ranked most-severe first (critical → info)."
        />
        <div className="space-y-2">
          {data.top_findings.map((f, i) => (
            <div key={i} className={`rounded-lg border-l-4 px-3 py-2 text-sm ${SEV[f.severity] ?? SEV.info}`}>
              <span className="mr-2 font-mono text-[10px] uppercase opacity-70">{f.code}</span>
              {f.message}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <SectionHead title="Narrative" desc="A short written summary tying the numbers together for a board-level read." />
        <Markdown source={data.narrative} />
      </div>
    </div>
  );
}
