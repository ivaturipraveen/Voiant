import { useEffect, useState } from "react";
import {
  api,
  fmtMoney,
  type AgentRunResponse,
  type AuditResponse,
  type LineageResponse,
  type SystemInfo,
} from "../api";
import DataTable from "./DataTable";
import { Icon, type IconName } from "./icons";

type StepKind = "ai" | "engine" | "io";
const STEP_META: Record<string, { icon: IconName; kind: StepKind }> = {
  Question: { icon: "chat", kind: "io" },
  Classify: { icon: "route", kind: "ai" },
  "Parse input": { icon: "search", kind: "engine" },
  "Shielded read": { icon: "shield", kind: "io" },
  Compute: { icon: "compute", kind: "engine" },
  "Assemble payload": { icon: "box", kind: "engine" },
  "Model explains": { icon: "cpu", kind: "ai" },
  "Audit & respond": { icon: "check", kind: "io" },
};

export default function BehindTheScenes({ role }: { role: string }) {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [trace, setTrace] = useState<{
    run: AgentRunResponse;
    audit: AuditResponse;
    lineage: LineageResponse;
  } | null>(null);
  const [tracing, setTracing] = useState(false);

  const loadSystem = () => api.system().then(setSys).catch(() => {});
  useEffect(() => {
    loadSystem();
  }, []);

  const runTrace = async () => {
    setTracing(true);
    try {
      const run = await api.chat("Is each rep's quota fair given their territory's opportunity?", role, null);
      const [audit, lineage] = await Promise.all([api.audit(run.run_id), api.lineage(run.run_id)]);
      setTrace({ run, audit, lineage });
      loadSystem();
    } finally {
      setTracing(false);
    }
  };

  if (!sys) return <div className="card p-8 text-center text-sm text-slatebody">Loading platform…</div>;

  const p = sys.platform;

  return (
    <div className="space-y-4">
      {/* Live pipeline */}
      <div className="card p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="panel-title">How every question flows through the platform</div>
          <button className="btn-primary shrink-0 inline-flex items-center gap-1.5" onClick={runTrace} disabled={tracing}>
            {!tracing && <Icon name="play" className="h-3.5 w-3.5" />}
            {tracing ? "Running…" : "Run a live trace"}
          </button>
        </div>
        <p className="mb-3 max-w-3xl text-xs leading-snug text-slatebody">
          Every question follows the <b className="text-navy">same governed path</b>. The AI only does two
          things — understand the question and explain the answer. <b className="text-navy">Every number is
          computed by a deterministic engine</b>, never by the model, so the same question always returns the
          same figures and every step is auditable.
        </p>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-slatebody">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> AI (Claude)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy" /> Deterministic engine</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Secure I/O</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sys.pipeline.map((s, i) => {
            const meta = STEP_META[s.step] ?? { icon: "check" as IconName, kind: "io" as StepKind };
            const border =
              meta.kind === "ai" ? "border-brand/40 bg-brand/[0.06]"
              : meta.kind === "engine" ? "border-navy/25 bg-navy/[0.03]"
              : "border-slate-200 bg-slate-50/60";
            const dot =
              meta.kind === "ai" ? "bg-brand" : meta.kind === "engine" ? "bg-navy" : "bg-slate-400";
            const ic = meta.kind === "ai" ? "text-brand-dark" : meta.kind === "engine" ? "text-navy" : "text-slatebody";
            return (
              <div key={s.step} className={`relative rounded-lg border p-2.5 ${border}`}>
                <div className="flex items-center gap-1.5">
                  <Icon name={meta.icon} className={`h-4 w-4 ${ic}`} />
                  <span className="font-display text-[11px] font-bold uppercase tracking-wide text-navy">
                    {s.step}
                  </span>
                  <span className={`ml-auto h-2 w-2 rounded-full ${dot}`} />
                </div>
                <div className="mt-1 text-[10px] leading-snug text-slatebody">{s.detail}</div>
                <span className="absolute -top-1.5 -left-1.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-bold text-navy ring-1 ring-slate-200">
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live trace result */}
      {trace && (
        <div className="card border-l-4 border-brand p-4">
          <div className="panel-title mb-3">Live trace — what just happened</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 text-xs">
              <TraceRow k="Question" v={`"${trace.run.question}"`} />
              <TraceRow
                k="Classified as"
                v={
                  trace.run.trace?.routing?.confidence != null
                    ? `${trace.run.agent} · ${Math.round(Number(trace.run.trace.routing.confidence) * 100)}% (semantic)`
                    : `${trace.run.agent} (${trace.run.routed_from})`
                }
              />
              {trace.run.trace?.routing?.reason && (
                <TraceRow k="Why this agent" v={trace.run.trace.routing.reason} />
              )}
              <TraceRow k="Determinism hash" v={trace.run.determinism_hash} mono />
              <TraceRow k="Explained by" v={trace.run.narrative_source} mono />
              <TraceRow
                k="Sent to model"
                v={`${trace.run.trace?.pipeline?.payload_bytes ?? "?"} bytes · 0 raw rows · 0 PII`}
              />
              <TraceRow k="Field reads (logged)" v={String(trace.lineage.events.length)} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold text-navy">Fields read (lineage)</div>
              <DataTable
                columns={[
                  { key: "agent", label: "Agent" },
                  { key: "field", label: "Field" },
                  { key: "masking", label: "Mask", className: "text-slatebody" },
                  { key: "reads", label: "Reads", align: "right" },
                ]}
                rows={trace.lineage.summary as unknown as Record<string, unknown>[]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Agent library */}
      <div className="card p-4">
        <div className="panel-title mb-3">Agent Library (shared across all clients)</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sys.agents.library.map((a) => {
            const built = a.status === "built";
            return (
              <div
                key={a.key}
                className={`rounded-lg border p-3 ${
                  built ? "border-brand/40 bg-brand/[0.06]" : "border-slate-200 bg-slate-50/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-navy">{a.name}</span>
                  <span
                    className={`chip text-[10px] font-semibold uppercase ${
                      built ? "bg-brand text-white" : "bg-slate-200 text-slatebody"
                    }`}
                  >
                    {built ? "Built" : a.phase}
                  </span>
                </div>
                <div className="mt-1 text-[11px] leading-snug text-slatebody">{a.responsibility}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[11px] text-slate-400">
          {sys.agents.registered.length} agents live in this build. New agents drop into the registry
          without touching the orchestrator.
        </div>
      </div>

      {/* Platform internals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <div className="panel-title mb-3">Brightcone Platform</div>
          <div className="space-y-2 text-xs">
            <PlatformRow label="Shield (PII)" value={p.shield.status} good={p.shield.status === "active"} />
            <div className="text-[11px] text-slatebody">{p.shield.base_url}</div>
            <div className="border-t border-slate-100 pt-2" />
            <PlatformRow label="Claude inference" value={p.llm.enabled ? "live" : "fallback"} good={p.llm.enabled} />
            <div className="text-[11px] text-slatebody">
              Default <b className="text-ink">{p.llm.default_model}</b> · Complex{" "}
              <b className="text-ink">{p.llm.complex_model}</b>
            </div>
            <div className="text-[11px] text-slatebody">{p.llm.routing}</div>
            <div className="border-t border-slate-100 pt-2" />
            <PlatformRow label="Client config" value={`v${p.config.version}`} />
            <div className="text-[11px] text-slatebody">
              {p.config.client_name} ({p.config.client_id})
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="panel-title mb-3">Dataset (what's loaded)</div>
          <div className="space-y-1.5 text-xs">
            <PlatformRow label="Reps" value={String(p.dataset.rep_count)} />
            <PlatformRow label="Demo data" value={p.dataset.mock_data ? "yes (synthetic)" : "no (live source)"} good />
            <PlatformRow
              label="Deployed vs target"
              value={`${fmtMoney(p.dataset.deployed_quota ?? 0)} ≠ ${fmtMoney(p.dataset.top_down_target ?? 0)}`}
            />
            <PlatformRow label="Paintbrushed segment" value={p.dataset.paintbrush_segment ?? "—"} />
            <PlatformRow label="Overloaded reps (seeded)" value={String(p.dataset.overloaded_rep_ids.length)} />
            <div className="pt-1 text-[11px] text-slatebody">
              Segments: {p.dataset.segments.join(", ")} · Regions: {p.dataset.regions.join(", ")}
            </div>
            <div className="text-[11px] text-slate-400">Snapshot {p.dataset.snapshot_id}</div>
          </div>
        </div>
      </div>

      {/* Shield vault */}
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="panel-title">Shield Token Vault — what the platform stores</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {sys.shield_token_summary && (
              <span className="chip bg-navy/5 text-navy">
                {sys.shield_token_summary.total} tokens
              </span>
            )}
            {sys.shield_token_summary &&
              Object.entries(sys.shield_token_summary.by_type).map(([et, n]) => (
                <span key={et} className={`chip ${entityChip(et)}`}>
                  <EntityDot type={et} />
                  {n} {et}
                </span>
              ))}
          </div>
        </div>

        {sys.shield_tokens.length === 0 ? (
          <div className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
            Shield disabled — no tokens (PII passes through unmasked).
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {sys.shield_tokens.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-2.5 py-1.5"
              >
                <span className="font-mono text-xs font-medium text-navy">{t.token}</span>
                <span className={`chip ml-auto ${entityChip(t.entity_type)}`}>
                  <EntityDot type={t.entity_type} />
                  {t.entity_type}
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-[10px] text-slate-400">{t.field}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] leading-snug text-slatebody">
          These opaque tokens are all the platform stores — never the real names or emails. Original
          values are re-hydrated only for authorized roles at read time, and every read is logged to
          the audit trail.
        </div>
      </div>
    </div>
  );
}

function entityChip(type: string): string {
  const t = (type || "").toUpperCase();
  if (t.includes("PERSON") || t.includes("NAME")) return "bg-brand/10 text-brand-dark";
  if (t.includes("EMAIL")) return "bg-indigo-50 text-indigo-600";
  if (t.includes("PHONE")) return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
}

function EntityDot({ type }: { type: string }) {
  const t = (type || "").toUpperCase();
  const color = t.includes("PERSON") || t.includes("NAME")
    ? "bg-brand"
    : t.includes("EMAIL")
      ? "bg-indigo-500"
      : t.includes("PHONE")
        ? "bg-amber-500"
        : "bg-slate-400";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function TraceRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-slatebody">{k}</span>
      <span className={`truncate text-right text-ink ${mono ? "font-mono" : ""}`} title={v}>
        {v}
      </span>
    </div>
  );
}

function PlatformRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slatebody">{label}</span>
      <span className={`font-semibold ${good ? "text-band-equitable" : "text-navy"}`}>{value}</span>
    </div>
  );
}
