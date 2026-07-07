import { Icon } from "./icons";
import { useEffect, useState } from "react";
import {
  api,
  fmtMoney,
  type AgentRunResponse,
  type Assumption,
  type AuditResponse,
  type ClientConfig,
  type LineageResponse,
} from "../api";

export function ConfigLedgerPanel({ onReload, role }: { onReload: () => void; role: string }) {
  const [cfg, setCfg] = useState<ClientConfig | null>(null);
  const load = () => api.config().then(setCfg).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="panel-title">Client Config — Interpretation Ledger</div>
        {role === "viewer" ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title="Read-only role">
            <Icon name="lock" className="h-3.5 w-3.5" /> Read-only
          </span>
        ) : (
          <button
            className="inline-flex items-center gap-1 text-[11px] text-brand-dark hover:underline"
            onClick={async () => {
              await api.reloadConfig();
              await load();
              onReload();
            }}
          >
            <Icon name="refresh" className="h-3.5 w-3.5" /> Reload
          </button>
        )}
      </div>
      {cfg && (
        <div className="space-y-3 text-xs">
          <div className="text-slatebody">
            {cfg.client_name} · v{cfg.version} · target{" "}
            <b className="text-ink">{fmtMoney(cfg.company.top_down_target)}</b>
          </div>
          <div>
            <div className="mb-1 font-semibold text-ink">Interpretation rules</div>
            {cfg.interpretation_rules.map((r) => (
              <div key={r.id} className="mb-1 rounded bg-slate-50 px-2 py-1">
                <div className="font-medium text-ink">{r.label}</div>
                <div className="text-slatebody">{r.rule}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 font-semibold text-ink">Segments</div>
            <div className="flex flex-wrap gap-1">
              {cfg.segment_definitions.map((s) => (
                <span key={s.name} className="rounded bg-slate-100 px-1.5 py-0.5 text-slatebody">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-ink">RBAC roles</div>
            <div className="flex flex-wrap gap-1">
              {cfg.rbac_roles.map((r) => (
                <span key={r.name} className="rounded bg-slate-100 px-1.5 py-0.5 text-slatebody">
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GovernanceTrail({ run }: { run: AgentRunResponse | null }) {
  const [lineage, setLineage] = useState<LineageResponse | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);

  useEffect(() => {
    if (!run) return;
    api.lineage(run.run_id).then(setLineage).catch(() => {});
    api.audit(run.run_id).then(setAudit).catch(() => {});
  }, [run]);

  if (!run) {
    return (
      <div className="card p-4 text-xs text-slatebody">
        <div className="panel-title mb-2">Audit & Lineage</div>
        Ask a question to populate the audit trail.
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="panel-title mb-2">Audit & Data Lineage</div>
      <div className="space-y-1 text-xs text-slatebody">
        <Row k="Determinism hash" v={run.determinism_hash.slice(0, 18) + "…"} />
        <Row k="Narrative source" v={run.narrative_source} />
        <Row k="Field reads" v={String(lineage?.events.length ?? 0)} />
        {audit?.inferences[0] && (
          <Row k="Config version" v={String((audit.inferences[0] as Record<string, unknown>).config_version)} />
        )}
        {audit?.llm_calls[0] && (
          <Row
            k="LLM"
            v={`${(audit.llm_calls[0] as Record<string, unknown>).model ?? "fallback"} ${
              (audit.llm_calls[0] as Record<string, unknown>).fell_back ? "(fallback)" : ""
            }`}
          />
        )}
      </div>

      {lineage && lineage.summary.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold text-ink">Fields read by agent</div>
          <table className="w-full text-[11px]">
            <thead className="text-slatebody">
              <tr>
                <th className="text-left font-medium">Agent</th>
                <th className="text-left font-medium">Field</th>
                <th className="text-left font-medium">Mask</th>
                <th className="text-right font-medium">Reads</th>
              </tr>
            </thead>
            <tbody>
              {lineage.summary.map((s, i) => (
                <tr key={i} className="text-ink">
                  <td>{s.agent}</td>
                  <td>{s.field}</td>
                  <td className="text-slatebody">{s.masking}</td>
                  <td className="text-right">{s.reads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AssumptionsFooter({ run }: { run: AgentRunResponse | null }) {
  if (!run) return null;
  let assumptions = run.report?.assumptions as Assumption[] | undefined;
  // Synthesis ("both") reports carry assumptions inside each sub-report — gather + dedupe.
  if ((!assumptions || assumptions.length === 0) && run.report?.reports) {
    const seen = new Set<string>();
    const merged: Assumption[] = [];
    for (const rep of Object.values(run.report.reports as Record<string, { assumptions?: Assumption[] }>)) {
      for (const a of rep?.assumptions ?? []) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          merged.push(a);
        }
      }
    }
    assumptions = merged;
  }
  if (!assumptions || assumptions.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
        Assumptions to confirm
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">
        {assumptions.map((a) => (
          <li key={a.id}>
            {a.statement} <span className="text-amber-600">— {a.basis}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-slatebody">{k}</span>
      <span className="truncate text-right font-mono text-ink" title={v}>
        {v}
      </span>
    </div>
  );
}
