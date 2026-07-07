import { useEffect, useState } from "react";
import { api, type Assumption, type LineageResponse } from "../api";

// Right rail on the dashboard pages: assumptions (from the run's report) and the audit
// trail (from the real lineage for that run). Both are data-driven; the audit shows a
// neutral empty state when no lineage exists rather than fabricating events.
export default function RightRail({
  assumptions,
  runId,
  onOpenAudit,
}: {
  assumptions: Assumption[];
  runId: string | null;
  onOpenAudit?: () => void;
}) {
  const [lineage, setLineage] = useState<LineageResponse | null>(null);

  useEffect(() => {
    setLineage(null);
    if (!runId) return;
    api.lineage(runId).then(setLineage).catch(() => setLineage(null));
  }, [runId]);

  const summary = lineage?.summary ?? [];
  const totalReads = summary.reduce((a, e) => a + (Number(e.reads) || 0), 0);

  return (
    <aside className="w-full shrink-0 space-y-4 xl:w-[300px]">
      {/* Assumptions to confirm */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-navy">Assumptions to confirm</span>
          {assumptions.length > 0 && (
            <span className="rounded-full bg-flag-text/15 px-2 py-0.5 text-[10px] font-bold text-flag-text">
              {assumptions.length}
            </span>
          )}
        </div>
        {assumptions.length === 0 ? (
          <p className="text-[12px] text-slate-400">No assumptions for this view.</p>
        ) : (
          <ul className="space-y-2.5">
            {assumptions.map((a) => (
              <li key={a.id} className="flex gap-2 text-[12.5px] leading-snug text-navy/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-flag-text/70" />
                <span>{a.statement}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Governance summary — this run at a glance; full history lives on the Audit log page */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-navy">Governance</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">This run</span>
        </div>
        {summary.length === 0 ? (
          <p className="text-[12px] text-slate-400">No activity recorded for this run yet.</p>
        ) : (
          <div className="space-y-2 text-[12.5px]">
            <Row k="Field reads logged" v={String(totalReads)} />
            <Row k="Fields accessed" v={String(summary.length)} />
            <Row k="Every read" v="audit-logged" />
          </div>
        )}
        {onOpenAudit && (
          <button
            onClick={onOpenAudit}
            className="mt-3 w-full rounded-lg border border-slate-200 py-1.5 text-[12px] font-semibold text-brand-dark transition hover:border-brand hover:bg-brand/5"
          >
            View full audit log →
          </button>
        )}
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slatebody">{k}</span>
      <span className="font-semibold tabular-nums text-navy">{v}</span>
    </div>
  );
}
