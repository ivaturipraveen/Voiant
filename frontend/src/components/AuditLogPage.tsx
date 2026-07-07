import { useEffect, useState } from "react";
import { api, type AuditEvent, type AuditResponse } from "../api";
import { PageHeader } from "./Shared";

const AGENT: Record<string, string> = {
  quota_equity: "Quota Equity",
  capacity_headroom: "Capacity Headroom",
  scenario_orchestrator: "Scenario Orchestrator",
};

function fmtTs(ts: string) {
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

// Browsable audit log — every analysis run stored in the DB (audit_inference), newest first.
// Click a row to expand its full detail: the model calls (model, fallback, token usage) and
// field reads for that run, fetched from /audit/{run_id}.
export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, AuditResponse>>({});

  useEffect(() => {
    api.recentAudit(100).then((r) => setEvents(r.events)).catch(() => setErr(true));
  }, []);

  const toggle = (runId: string) => {
    setOpen((cur) => (cur === runId ? null : runId));
    if (!detail[runId]) {
      api.audit(runId).then((d) => setDetail((m) => ({ ...m, [runId]: d }))).catch(() => {});
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        sub="Every analysis run recorded to the database. Click a row for its model calls, token usage, and field reads."
      />

      <div className="card p-0">
        {err ? (
          <div className="p-8 text-center text-sm text-slatebody">Couldn't load the audit log.</div>
        ) : !events ? (
          <div className="p-8 text-center text-sm text-slatebody">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slatebody">No runs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slatebody">
                  <th className="w-8 px-4 py-2.5" />
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-4 py-2.5 text-right">Config v</th>
                  <th className="px-4 py-2.5 text-right">Field reads</th>
                  <th className="px-4 py-2.5">Data</th>
                  <th className="px-4 py-2.5">Determinism hash</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const isOpen = open === e.run_id;
                  const d = detail[e.run_id];
                  return (
                    <>
                      <tr
                        key={e.run_id + e.ts}
                        onClick={() => toggle(e.run_id)}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-2.5 text-slate-400">
                          <span className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slatebody tabular-nums">{fmtTs(e.ts)}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-navy">
                          {AGENT[e.agent] ?? e.agent}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink">v{e.config_version}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink">{e.field_reads}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              e.mock_data ? "bg-flag-bg text-flag-text" : "bg-band-equitable/15 text-band-equitable"
                            }`}
                          >
                            {e.mock_data ? "demo" : "live"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {e.determinism_hash.slice(0, 16)}…
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={e.run_id + "-d"} className="border-b border-slate-100 bg-slate-50/40">
                          <td />
                          <td colSpan={6} className="px-4 py-3">
                            <RunDetail event={e} data={d} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {events && events.length > 0 && (
        <p className="text-[11px] text-slate-400">Showing the {events.length} most recent runs.</p>
      )}
    </div>
  );
}

function RunDetail({ event, data }: { event: AuditEvent; data?: AuditResponse }) {
  const llm = data?.llm_calls ?? [];
  return (
    <div className="space-y-3 text-[12.5px]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        <Fact k="Run ID" v={event.run_id} mono />
        <Fact k="Config version" v={`v${event.config_version}`} />
        <Fact k="Field reads" v={String(event.field_reads)} />
        <Fact k="Determinism hash" v={event.determinism_hash} mono wrap />
      </div>

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slatebody">Model calls</div>
        {!data ? (
          <p className="text-[12px] text-slate-400">Loading…</p>
        ) : llm.length === 0 ? (
          <p className="text-[12px] text-slate-400">No model call (answered deterministically).</p>
        ) : (
          <ul className="space-y-1.5">
            {llm.map((c, i) => {
              const model = (c.model as string) ?? "—";
              const fell = c.fell_back as boolean;
              const det = (c.detail ?? {}) as { input_tokens?: number; output_tokens?: number; cost_usd?: number };
              const inTok = Number(det.input_tokens ?? 0);
              const outTok = Number(det.output_tokens ?? 0);
              const cost = Number(det.cost_usd ?? 0);
              return (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="font-medium text-navy">{String(c.purpose ?? "narrative").replace(/_/g, " ")}</span>
                  <span className="font-mono text-[11px] text-slatebody">{fell ? "deterministic fallback" : model}</span>
                  {!fell && (inTok > 0 || outTok > 0) && (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="rounded bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand-dark tabular-nums">
                        {inTok.toLocaleString()} in · {outTok.toLocaleString()} out
                      </span>
                      {cost > 0 && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-navy tabular-nums">
                          ${cost.toFixed(4)}
                        </span>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Fact({ k, v, mono, wrap }: { k: string; v: string; mono?: boolean; wrap?: boolean }) {
  return (
    <div className={wrap ? "col-span-2 sm:col-span-3" : ""}>
      <span className="text-slatebody">{k}: </span>
      <span className={`font-semibold text-navy ${mono ? "break-all font-mono text-[11px]" : ""}`}>{v}</span>
    </div>
  );
}
