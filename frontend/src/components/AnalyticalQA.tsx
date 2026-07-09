import { type RefObject, useMemo, useState } from "react";
import type { AgentRunResponse, Assumption, CapacityReport, QuotaEquityReport } from "../api";
import ChatPanel from "./ChatPanel";
import InspectPanel from "./InspectPanel";
import Markdown from "./Markdown";
import ResultRenderer from "./ResultRenderer";
import ThinkingIndicator from "./ThinkingIndicator";

const AGENT_LABEL: Record<string, string> = {
  quota_equity: "Quota Equity",
  capacity_headroom: "Capacity Headroom",
  synthesis: "Scenario Orchestrator",
  scenario_orchestrator: "Scenario Orchestrator",
};

const NORMAL_BAR = "#3B82F6";
const HIGHLIGHT_BAR = "#d9714f";

type ChartRow = { label: string; value: number; highlight: boolean };

// Group per-rep rows into a per-segment average of the given numeric field.
function segmentAverages(
  rows: Array<{ segment: string; [k: string]: unknown }>,
  field: string
): Array<{ segment: string; value: number }> {
  const map = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const v = Number(r[field]);
    if (Number.isNaN(v)) continue;
    const e = map.get(r.segment) ?? { sum: 0, n: 0 };
    e.sum += v;
    e.n += 1;
    map.set(r.segment, e);
  }
  return Array.from(map.entries()).map(([segment, { sum, n }]) => ({ segment, value: n ? sum / n : 0 }));
}

// Pick the quota or capacity report out of a run (handles synthesis wrapping).
function pickReports(run: AgentRunResponse): { quota?: QuotaEquityReport; capacity?: CapacityReport } {
  if (run.report_type === "quota_equity") return { quota: run.report as QuotaEquityReport };
  if (run.report_type === "capacity_headroom") return { capacity: run.report as CapacityReport };
  if (run.report_type === "synthesis") {
    const reports = run.report?.reports ?? {};
    return { quota: reports.quota_equity, capacity: reports.capacity_headroom };
  }
  return {};
}

// A compact, inline bar chart that summarizes the answer visually — average fairness ratio
// (quota) or load index (capacity) by segment, with the outlier segment highlighted.
function AnswerChart({ run }: { run: AgentRunResponse }) {
  const { quota, capacity } = pickReports(run);

  let title = "";
  let rows: ChartRow[] = [];

  if (quota) {
    const paint = new Set(quota.segments.filter((s) => s.is_paintbrushed).map((s) => s.segment));
    const avgs = segmentAverages(quota.per_rep as unknown as Array<{ segment: string }>, "fairness_ratio");
    const maxSeg = avgs.reduce((a, b) => (b.value > a.value ? b : a), avgs[0] ?? { segment: "", value: 0 });
    title = "Average fairness ratio by segment · FY26";
    rows = avgs.map((a) => ({ label: a.segment, value: a.value, highlight: paint.has(a.segment) || a.segment === maxSeg.segment }));
  } else if (capacity) {
    const avgs = segmentAverages(capacity.per_rep as unknown as Array<{ segment: string }>, "load_index");
    title = "Average load index by segment · FY26";
    rows = avgs.map((a) => ({ label: a.segment, value: a.value, highlight: a.value > 1.2 }));
  }

  if (!rows.length) return null;

  const maxScale = Math.max(0.1, ...rows.map((r) => r.value)) * 1.12;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-[12px]">
            <span className="w-24 shrink-0 truncate text-slate-600" title={r.label}>
              {r.label}
            </span>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="h-3.5 rounded"
                style={{ width: `${(r.value / maxScale) * 100}%`, background: r.highlight ? HIGHLIGHT_BAR : NORMAL_BAR }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-navy">{r.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gather assumptions from a run, merging + de-duplicating across synthesis sub-reports.
function runAssumptions(run: AgentRunResponse): Assumption[] {
  let assumptions = run.report?.assumptions as Assumption[] | undefined;
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
  return assumptions ?? [];
}

// Split the narrative into a highlighted lead paragraph + the remaining body (matches the
// mockup's summary box above the detailed write-up). Falls back to no-lead if the narrative
// opens with a heading or list.
function splitLead(src: string): { lead: string | null; body: string } {
  const text = (src ?? "").replace(/\r/g, "").trim();
  const parts = text.split(/\n\s*\n/);
  if (parts.length > 1 && parts[0] && !/^[#\-*\d]/.test(parts[0].trim())) {
    return { lead: parts[0].trim(), body: parts.slice(1).join("\n\n") };
  }
  return { lead: null, body: text };
}

function QACard({
  turn,
  isLast,
  showInspect,
  onToggleInspect,
  sessionLabel,
  onAsk,
  loading,
  innerRef,
}: {
  turn: AgentRunResponse;
  isLast: boolean;
  showInspect: boolean;
  onToggleInspect: () => void;
  sessionLabel: string;
  onAsk: (q: string) => void;
  loading: boolean;
  innerRef?: RefObject<HTMLDivElement>;
}) {
  const [showSupport, setShowSupport] = useState(false);
  const agent = AGENT_LABEL[turn.report_type] ?? "Agent";
  const conf = turn.trace?.routing?.confidence;
  const { lead, body } = splitLead(turn.narrative);
  const assumptions = runAssumptions(turn);
  const followups = turn.suggested_followups ?? [];

  return (
    <div
      ref={innerRef}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      {/* Coral session header */}
      <div className="flex items-center justify-between bg-[#d9714f] px-5 py-2.5 text-white">
        <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wide">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          Ask Voiant
        </span>
        <span className="text-[11px] font-medium text-white/85">Session · {sessionLabel}</span>
      </div>

      <div className="p-5 sm:p-6">
        {/* Question */}
        <div className="border-l-2 border-brand pl-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Question</div>
          <h3 className="mt-0.5 font-display text-[17px] font-semibold leading-snug tracking-tight text-navy">
            {turn.question}
          </h3>
        </div>

        {/* Agent pill + routing line */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="rounded bg-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {agent} Agent
          </span>
          <span>
            Routed by Scenario Orchestrator
            {conf != null && ` · ${Math.round(Number(conf) * 100)}% confident`}
            {turn.routed_from && !isLast ? " · follow-up" : ""}
            {" · cross-references TAM, deployed quota, and productivity baseline"}
          </span>
        </div>

        {/* Highlighted lead */}
        {lead && (
          <div className="mt-4 rounded-lg border-l-2 border-brand bg-slate-50/80 px-4 py-3">
            <Markdown source={lead} />
          </div>
        )}

        {/* Body narrative */}
        {body && (
          <div className="mt-4">
            <Markdown source={body} />
          </div>
        )}

        {/* Inline graphical representation */}
        <AnswerChart run={turn} />

        {/* Assumptions applied */}
        {assumptions.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Assumptions applied
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
              {assumptions.map((a) => a.statement).join(" ")}
            </p>
          </div>
        )}

        {/* Suggested follow-up questions */}
        {followups.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Suggested follow-up questions
            </div>
            <div className="mt-2 space-y-1">
              {followups.map((q) => (
                <button
                  key={q}
                  onClick={() => onAsk(q)}
                  disabled={loading}
                  className="flex items-center gap-2 text-left text-[13px] text-brand-dark transition hover:underline disabled:opacity-50"
                >
                  <span className="text-slate-300">→</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions + provenance */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <button onClick={() => setShowSupport((s) => !s)} className="btn-ghost py-1.5 text-xs">
            {showSupport ? "Hide" : "Show"} supporting charts &amp; tables
          </button>
          {isLast && (
            <button onClick={onToggleInspect} className="btn-ghost py-1.5 text-xs">
              {showInspect ? "Hide" : "Technical"} details
            </button>
          )}
          <span className="ml-auto self-center text-[11px] text-slate-400">
            via {turn.narrative_source} · hash {turn.determinism_hash.slice(0, 10)}
          </span>
        </div>

        {isLast && showInspect && (
          <div className="mt-3">
            <InspectPanel run={turn} />
          </div>
        )}
        {showSupport && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ResultRenderer run={turn} />
          </div>
        )}
      </div>
    </div>
  );
}

// Analytical Q&A (§ 05) — the conversational agent framed as a document-style Q&A surface.
// All routing, follow-ups, session context, role masking, technical trace, and supporting
// charts are unchanged; only the presentation is restyled to match the report.
export default function AnalyticalQA({
  chatHistory,
  loading,
  pendingQuestion,
  onAsk,
  chatRun,
  showInspect,
  onToggleInspect,
  lastTurnRef,
  pendingRef,
}: {
  chatHistory: AgentRunResponse[];
  loading: boolean;
  pendingQuestion: string;
  onAsk: (q: string) => void;
  chatRun: AgentRunResponse | null;
  showInspect: boolean;
  onToggleInspect: () => void;
  lastTurnRef: RefObject<HTMLDivElement>;
  pendingRef: RefObject<HTMLDivElement>;
}) {
  const sessionLabel = useMemo(() => {
    const d = new Date();
    return `${d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString(
      "en-US",
      { hour: "2-digit", minute: "2-digit", hour12: false }
    )}`;
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[16px] font-semibold tracking-tight text-navy">
          <span className="mr-2 font-mono text-[12px] text-slate-400">§ 05</span>
          Analytical Q&amp;A
        </h3>
        <span className="text-[11px] text-slate-400">
          Natural-language interrogation of the underlying model · sources cited in every response
        </span>
      </div>

      {chatHistory.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between bg-[#d9714f] px-5 py-2.5 text-white">
            <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
              Ask Voiant
            </span>
            <span className="text-[11px] font-medium text-white/85">Session · {sessionLabel}</span>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            {loading ? (
              <div ref={pendingRef} className="scroll-mt-24 space-y-3">
                <QuestionLine text={pendingQuestion} />
                <ThinkingIndicator question={pendingQuestion} />
              </div>
            ) : (
              <div className="max-w-xl">
                <p className="text-[13.5px] font-medium text-navy">Ask a question to begin.</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
                  The matching analysis opens with your answer, complete with reasoning and sources. Follow-up
                  questions keep the context — ask “why?” or “what about the West?” and it stays on topic.
                </p>
              </div>
            )}
            <ChatPanel onAsk={onAsk} loading={loading} run={chatRun} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Scrollable thread — content scrolls here, composer stays pinned below */}
          <div className="max-h-[58vh] space-y-5 overflow-y-auto pr-1.5">
            {chatHistory.map((turn, i) => {
              const isLast = i === chatHistory.length - 1;
              return (
                <QACard
                  key={turn.run_id + i}
                  turn={turn}
                  isLast={isLast}
                  showInspect={showInspect}
                  onToggleInspect={onToggleInspect}
                  sessionLabel={sessionLabel}
                  onAsk={onAsk}
                  loading={loading}
                  innerRef={isLast ? lastTurnRef : undefined}
                />
              );
            })}
            {loading && (
              <div
                ref={pendingRef}
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <div className="flex items-center justify-between bg-[#d9714f] px-5 py-2.5 text-white">
                  <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    Ask Voiant
                  </span>
                  <span className="text-[11px] font-medium text-white/85">Session · {sessionLabel}</span>
                </div>
                <div className="space-y-3 p-5 sm:p-6">
                  <QuestionLine text={pendingQuestion} />
                  <ThinkingIndicator question={pendingQuestion} />
                </div>
              </div>
            )}
          </div>

          {/* Composer — pinned below the scrollable thread */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <ChatPanel onAsk={onAsk} loading={loading} run={chatRun} bare hideChips />
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="border-l-2 border-brand pl-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Question</div>
      <h3 className="mt-0.5 font-display text-[17px] font-semibold leading-snug tracking-tight text-navy">{text}</h3>
    </div>
  );
}
