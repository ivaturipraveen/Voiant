import { type ReactNode, useState } from "react";
import type { AgentRunResponse } from "../api";

// Technical "what happened inside" view for one run: how the question was classified, what data
// was read + masked, the exact numbers/findings the engine produced, what we sent to the model,
// and what it returned. Everything the system knows about this run, in order.
export default function InspectPanel({ run }: { run: AgentRunResponse }) {
  const t = run.trace;
  if (!t) return null;

  const findings = (t.findings ?? []) as Finding[];
  const assumptions = (t.assumptions ?? []) as Assumption[];
  const segments = (t.segments ?? []) as Record<string, unknown>[];
  let n = 0;

  return (
    <div className="card overflow-hidden border-l-4 border-brand">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dark">
          Behind the scenes
        </div>
        <div className="font-display text-sm font-bold text-navy">Technical trace — every step of this run</div>
      </div>
      <div className="p-4">
        {t.pipeline && <PipelineFlow run={run} p={t.pipeline} routing={t.routing} parsing={t.input_parsing} />}

        <Step n={(n += 1)} title="Routing — how your question was classified">
          <KV k="Your question" v={`“${run.question}”`} />
          <KV k="Chosen agent" v={agentLabel(t.routing?.chosen_agent ?? run.agent)} strong />
          <KV k="Classified by" v={methodLabel(t.routing?.method ?? run.routed_from)} />
          {t.routing?.model && <KV k="Classifier model" v={t.routing.model} mono />}
          {t.routing?.confidence != null && (
            <Confidence value={Number(t.routing.confidence)} />
          )}
          {t.routing?.reason && <KV k="Why this agent" v={t.routing.reason} />}
          {t.routing?.agents_available && (
            <KV k="Agents available" v={(t.routing.agents_available as string[]).map(agentLabel).join(" · ")} />
          )}
          <Note>
            A small model reads the <b>meaning</b> of your question — no keyword matching. If the model is
            offline we stay on the previous agent, else default to Quota Equity.
          </Note>
        </Step>

        {t.input_parsing && (
          <Step n={(n += 1)} title="Input parsing — what we pulled from your question">
            <KV k="Your question" v={`“${t.input_parsing.raw_question ?? run.question}”`} />
            <KV k="Detected intent" v={intentLabel(t.input_parsing.detected_intent)} strong />
            {t.input_parsing.extracted_params &&
              Object.keys(t.input_parsing.extracted_params).length > 0 && (
                <div className="mt-1.5">
                  <div className="mb-1 text-[10.5px] font-semibold text-slatebody">Parameters extracted from the text</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(t.input_parsing.extracted_params).map(([k, v]) => (
                      <span key={k} className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-dark">
                        {k} = {v == null ? "—" : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            {t.input_parsing.how?.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {(t.input_parsing.how as string[]).map((h, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] leading-snug text-ink">
                    <span className="text-brand-dark">›</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
            <Note>
              Deterministic parsing (regex + keyword triggers) — <b>not</b> the model. The extracted
              parameters drive the engine's what-if math directly.
            </Note>
          </Step>
        )}

        <Step n={(n += 1)} title="Secure read through Shield">
          <KV k="Your role" v={t.shield?.role} strong />
          <KV k="What you can see" v={t.shield?.masking_policy} />
          {t.shield?.masked_fields && (
            <KV k="PII columns (from config)" v={(t.shield.masked_fields as string[]).join(", ")} mono />
          )}
          {t.shield?.pii_source && <KV k="PII declared by" v={t.shield.pii_source} />}
          <KV k="Reps masked in the vault" v={String(t.shield?.total_reps_masked ?? "")} />
          <KV k="Field reads logged (lineage)" v={String(t.shield?.field_reads ?? "")} />
          {t.shield?.tokenisation && <Note>{t.shield.tokenisation}</Note>}
          {t.shield?.sample?.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slatebody">
                  <tr>
                    <Th>Rep</Th>
                    <Th>Stored in DB (token)</Th>
                    <Th>You see (re-hydrated)</Th>
                  </tr>
                </thead>
                <tbody>
                  {t.shield.sample.map((s: Record<string, string>, i: number) => (
                    <tr key={i} className="border-t border-slate-100 text-ink">
                      <Td mono>{s.rep_id}</Td>
                      <Td mono accent>{s.name_stored}</Td>
                      <Td>{s.name_you_see}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Note>Sample of {t.shield?.sample?.length ?? 0} of {t.shield?.total_reps_masked ?? "all"} reps — showing token → name un-masking for your role.</Note>
        </Step>

        <Step n={(n += 1)} title="Deterministic engine — the math (no AI)">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(t.engine ?? {}).map(([k, v]) => (
              <KV key={k} k={humanize(k)} v={fmt(k, v)} mono />
            ))}
          </div>
          <Note>Every number is computed here in pure Python over all reps, then hashed — same question → identical figures.</Note>
        </Step>

        {findings.length > 0 && (
          <Step n={(n += 1)} title={`Findings raised by the engine (${findings.length})`}>
            <div className="space-y-1.5">
              {findings.map((f, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="mb-0.5 flex items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-mono text-[10px] text-navy">{f.code}</span>
                    <span className="ml-auto text-[10px] text-slatebody">{f.subject}</span>
                  </div>
                  <p className="text-[11px] text-ink">{f.message}</p>
                  {f.evidence && Object.keys(f.evidence).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(f.evidence).map(([ek, ev]) => (
                        <span key={ek} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slatebody">
                          {ek}: {String(ev)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Step>
        )}

        {segments.length > 0 && (
          <Step n={(n += 1)} title="Segment breakdown">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slatebody">
                  <tr>
                    {Object.keys(segments[0]).map((h) => (
                      <Th key={h}>{humanize(h)}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {segments.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100 text-ink">
                      {Object.entries(s).map(([k, v]) => (
                        <Td key={k} mono={typeof v === "number"}>
                          {typeof v === "boolean" ? (v ? "yes" : "—") : String(v)}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Step>
        )}

        {assumptions.length > 0 && (
          <Step n={(n += 1)} title={`Assumptions to confirm (${assumptions.length})`}>
            <ul className="space-y-1.5">
              {assumptions.map((a, i) => (
                <li key={i} className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-2">
                  <p className="text-[11px] font-medium text-ink">{a.statement}</p>
                  <p className="mt-0.5 text-[10px] text-slatebody">
                    Basis: {a.basis}
                    {a.confidence && <> · confidence: {a.confidence}</>}
                  </p>
                </li>
              ))}
            </ul>
          </Step>
        )}

        <Step n={(n += 1)} title="Data retrieval & payload assembly — what goes to Claude">
          <KV k="Data source" v={t.pipeline?.source} />
          <KV k="Rows available in snapshot" v={String(t.pipeline?.rows_available ?? "")} />
          <KV k="Rows used for this query" v={String(t.pipeline?.rows_used ?? "")} strong />
          <KV k="Rows filtered out by the query" v={String(t.pipeline?.rows_filtered_out ?? 0)} />
          {t.pipeline?.selection_basis && <Note>{t.pipeline.selection_basis}</Note>}
          {t.pipeline?.fields_used?.length > 0 && (
            <div className="mt-1.5">
              <div className="mb-1 text-[10.5px] font-semibold text-slatebody">Fields read per rep</div>
              <div className="flex flex-wrap gap-1">
                {(t.pipeline.fields_used as string[]).map((f) => (
                  <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-navy">{f}</span>
                ))}
              </div>
            </div>
          )}
          {t.pipeline?.computation && (
            <div className="mt-1.5">
              <div className="mb-0.5 text-[10.5px] font-semibold text-slatebody">How the engine turns those rows into the answer</div>
              <p className="text-[11px] leading-snug text-ink">{t.pipeline.computation}</p>
            </div>
          )}
          <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
            <KV k="Projected to" v={t.pipeline?.projection} />
            <KV k="Raw rep rows sent to the model" v={String(t.data_selection?.raw_rows_sent_to_model ?? 0)} />
            <KV k="PII sent to the model" v={String(t.data_selection?.pii_sent_to_model ?? false)} />
            <KV k="Final payload size" v={`${t.pipeline?.payload_bytes ?? t.data_selection?.model_input_bytes ?? 0} bytes JSON`} mono />
          </div>
          {t.data_selection?.note && <Note>{t.data_selection.note}</Note>}
        </Step>

        <Step n={(n += 1)} title="Model — what we sent & what came back">
          <KV k="Model" v={t.model?.model} mono strong />
          <KV k="Fell back to deterministic" v={String(t.model?.fell_back)} />
          <Collapsible label="System prompt (instructions to the model)">
            <pre className="whitespace-pre-wrap break-words text-[11px] text-slatebody">{t.model?.system_prompt}</pre>
          </Collapsible>
          <Collapsible label="Input SENT to the model (computed numbers as JSON)">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-navy">
              {prettyJson(t.model?.input_sent)}
            </pre>
          </Collapsible>
          <Collapsible label="Output RECEIVED from the model (the explanation)">
            <pre className="whitespace-pre-wrap break-words text-[11px] text-ink">{t.model?.output_received}</pre>
          </Collapsible>
        </Step>

        {run.memory && run.memory.length > 0 && (
          <Step n={(n += 1)} title="Session memory — what the assistant remembers">
            <Note>Kept in memory for this session only (not stored in the database). Used so vague follow-ups stay on the right agent.</Note>
            <ol className="mt-1 space-y-1">
              {run.memory.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-navy">
                    {i + 1}
                  </span>
                  <span className="truncate text-ink">“{m.question}”</span>
                  <span className="ml-auto shrink-0 rounded bg-brand/10 px-1.5 font-mono text-[10px] text-brand-dark">
                    {m.agent}
                  </span>
                </li>
              ))}
            </ol>
          </Step>
        )}
      </div>
    </div>
  );
}

interface Finding {
  code: string;
  severity: string;
  subject: string;
  message: string;
  evidence?: Record<string, string | number>;
}
interface Assumption {
  statement: string;
  basis: string;
  confidence?: string;
}

function PipelineFlow({
  run,
  p,
  routing,
  parsing,
}: {
  run: AgentRunResponse;
  p: Record<string, unknown>;
  routing?: Record<string, unknown>;
  parsing?: Record<string, unknown>;
}) {
  const conf = routing?.confidence != null ? `${Math.round(Number(routing.confidence) * 100)}%` : null;
  const params = (parsing?.extracted_params ?? {}) as Record<string, unknown>;
  const hasParams = Object.keys(params).length > 0;
  const stages = [
    {
      icon: "💬",
      title: "Your question",
      value: `“${run.question}”`,
    },
    {
      icon: "🧭",
      title: "Semantic classification",
      value: `${agentLabel(String(routing?.chosen_agent ?? run.agent))}${conf ? ` · ${conf} confident` : ""}`,
      sub: routing?.reason ? String(routing.reason) : undefined,
    },
    ...(parsing
      ? [
          {
            icon: "🔎",
            title: "Input parsed",
            value: hasParams
              ? `${intentLabel(String(parsing.detected_intent))} — ${Object.entries(params)
                  .map(([k, v]) => `${k}=${v == null ? "—" : v}`)
                  .join(", ")}`
              : intentLabel(String(parsing.detected_intent)),
            sub: "Deterministic regex + keyword parse — not the model.",
          },
        ]
      : []),
    {
      icon: "🗄️",
      title: "Data retrieved",
      value: `${p.rows_used} of ${p.rows_available} reps used · ${p.rows_filtered_out} filtered out`,
      sub: "From the in-memory masked snapshot (not a new DB query per question).",
    },
    {
      icon: "🧮",
      title: "Engine computes (pure Python)",
      value: "Aggregates + findings + assumptions over all reps",
      sub: p.computation ? String(p.computation) : undefined,
    },
    {
      icon: "📦",
      title: "Payload finalized",
      value: `${p.payload_bytes} bytes JSON — 0 raw rows, 0 PII`,
      sub: "The computed summary + your question, serialized to JSON.",
    },
    {
      icon: "🤖",
      title: "Sent to model",
      value: String(p.destination_model),
      sub: "The model explains the numbers — it never computes or sees raw data.",
    },
  ];
  return (
    <div className="mb-4 rounded-xl border border-brand/20 bg-brand/[0.04] p-3">
      <div className="mb-2 font-display text-[11px] font-bold uppercase tracking-[0.1em] text-navy">
        How this answer was finalized
      </div>
      <ol className="space-y-0">
        {stages.map((s, i) => (
          <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
            {i < stages.length - 1 && (
              <span className="absolute left-[13px] top-6 h-full w-px bg-brand/25" aria-hidden />
            )}
            <span className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm ring-1 ring-brand/30">
              {s.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                  {s.title}
                </span>
              </div>
              <div className="truncate text-xs font-medium text-navy">{s.value}</div>
              {s.sub && <div className="mt-0.5 text-[10.5px] leading-snug text-slatebody">{s.sub}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function intentLabel(i?: string): string {
  const map: Record<string, string> = {
    add_heads: "Add headcount (what-if)",
    cut_heads: "Cut headcount (what-if)",
    headroom_query: "Headroom query",
    base_analysis: "Base capacity analysis",
    fairness_analysis: "Quota fairness analysis",
  };
  return map[i ?? ""] ?? (i ?? "");
}

function agentLabel(a?: string): string {
  const map: Record<string, string> = {
    quota_equity: "Quota Equity",
    capacity_headroom: "Capacity Headroom",
    scenario_orchestrator: "Scenario Orchestrator",
    synthesis: "Synthesis (both agents)",
  };
  return map[a ?? ""] ?? (a ?? "");
}

function methodLabel(m?: string): string {
  const map: Record<string, string> = {
    model: "small model — semantic classification",
    "model-classified": "small model — semantic classification",
    "conversation-context": "conversation context (model offline)",
    "context-fallback": "conversation context (model offline)",
    default: "default (model offline)",
    explicit: "explicit — you picked the agent",
  };
  return map[m ?? ""] ?? (m ?? "");
}

function humanize(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/\bpct\b/i, "%")
    .replace(/\bcv\b/i, "CV")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fmt(k: string, v: unknown): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (v == null) return "—";
  // Money-ish fields: format large integer-strings with commas.
  if (/quota|target|capacity|assignment/i.test(k) && /^\d+(\.\d+)?$/.test(String(v))) {
    const num = Number(v);
    if (num >= 1000) return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (/pct|%/i.test(k) && typeof v === "number") return `${v.toFixed(1)}%`;
  return String(v);
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-band-equitable" : pct >= 60 ? "bg-band-stretched" : "bg-band-overloaded";
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slatebody">Confidence</span>
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
          <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
        </span>
        <span className="w-8 text-right font-mono text-ink">{pct}%</span>
      </span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = (severity || "").toLowerCase();
  const cls =
    s.includes("high") || s.includes("crit")
      ? "bg-red-100 text-red-700"
      : s.includes("med") || s.includes("warn")
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>{severity}</span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mb-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand font-mono text-[10px] font-bold text-white">
          {n}
        </span>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-navy">{title}</span>
      </div>
      <div className="space-y-0.5 pl-7">{children}</div>
    </div>
  );
}

function KV({ k, v, mono, strong }: { k: string; v?: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-slatebody">{k}</span>
      <span className={`text-right ${strong ? "font-semibold text-navy" : "text-ink"} ${mono ? "font-mono" : ""}`}>
        {v}
      </span>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5 text-[10.5px] leading-snug text-slatebody">{children}</p>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-2 py-1 text-left font-display text-[10px] font-semibold uppercase tracking-wide">{children}</th>;
}

function Td({ children, mono, accent }: { children: ReactNode; mono?: boolean; accent?: boolean }) {
  return (
    <td className={`px-2 py-1 ${mono ? "font-mono" : ""} ${accent ? "text-navy" : ""}`}>{children}</td>
  );
}

function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-semibold text-brand-dark hover:underline"
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

function prettyJson(s?: string): string {
  if (!s) return "";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
