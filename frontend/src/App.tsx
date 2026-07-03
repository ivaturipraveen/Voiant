import { type ReactNode, useEffect, useRef, useState } from "react";
import { api, type AgentRunResponse, type Health } from "./api";
import BehindTheScenes from "./components/BehindTheScenes";
import ChatPanel from "./components/ChatPanel";
import ConfigPage from "./components/ConfigPage";
import HelpGlossary from "./components/HelpGlossary";
import InspectPanel from "./components/InspectPanel";
import ExecutiveSummary, { clearExecCache } from "./components/ExecutiveSummary";
import { AssumptionsFooter, ConfigLedgerPanel, GovernanceTrail } from "./components/GovernancePanels";
import ResultRenderer from "./components/ResultRenderer";
import RoleBanner from "./components/RoleBanner";
import ThinkingIndicator from "./components/ThinkingIndicator";
import VoiantHeader from "./components/VoiantHeader";

type Mode = "ask" | "territory" | "capacity" | "executive" | "platform" | "config";

// Top-level nav is 3 items: Conversational · Dashboards ▾ · Behind the Scenes.
const DASH_TABS: Array<{ id: Mode; label: string; sub: string }> = [
  { id: "territory", label: "Territory Equity", sub: "Quota fairness" },
  { id: "capacity", label: "Capacity Overview", sub: "Load & headroom" },
  { id: "executive", label: "Executive Summary", sub: "Top findings" },
];
const DASH_MODES: Mode[] = ["territory", "capacity", "executive"];

const TITLES: Record<Mode, { eyebrow: string; title: string; sub: string }> = {
  ask: { eyebrow: "Conversational", title: "Ask Voiant Intelligence", sub: "Natural-language sales planning over your data" },
  territory: { eyebrow: "Dashboard", title: "Territory Equity", sub: "Quota fairness, deployed vs target, paintbrush detection" },
  capacity: { eyebrow: "Dashboard", title: "Capacity Overview", sub: "Rep load, headroom, and redistribution" },
  executive: { eyebrow: "Dashboard", title: "Executive Summary", sub: "Top findings across the organization this week" },
  platform: { eyebrow: "Technical", title: "Behind the Scenes", sub: "Agents, pipeline, Shield, model routing & audit — live" },
  config: { eyebrow: "Client setup", title: "Configuration", sub: "The interpretation rules the agents apply — view & tune live" },
};

// One-line description shown on hover for each tab (reduces "what is this tab?" confusion).
const TAB_HELP: Record<Mode, string> = {
  ask: "Ask any sales-planning question in plain English",
  territory: "Dashboard: quota fairness (deployed vs target, heatmap)",
  capacity: "Dashboard: rep load, headroom & redistribution",
  executive: "Dashboard: the top findings across the org",
  platform: "Technical view: agents, pipeline, Shield & audit",
  config: "Client configuration — view & tune the rules live",
};

// Which dashboard a chat answer maps to, so we can offer "open the full dashboard →".
const DASH_FOR: Record<string, { mode: Mode; label: string; agent: string }> = {
  quota_equity: { mode: "territory", label: "Territory Equity", agent: "Quota Equity" },
  capacity_headroom: { mode: "capacity", label: "Capacity Overview", agent: "Capacity Headroom" },
  synthesis: { mode: "executive", label: "Executive Summary", agent: "Scenario Orchestrator" },
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  // Default to admin so the demo shows real rep names first; switch down to
  // analyst / viewer to demonstrate PII masking.
  const [role, setRole] = useState("admin");
  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Mode) || "ask";
  const [mode, setMode] = useState<Mode>(
    ["ask", "territory", "capacity", "executive", "platform", "config"].includes(initialTab) ? initialTab : "ask"
  );
  const [run, setRun] = useState<AgentRunResponse | null>(null); // last conversational/dashboard run for governance trail
  const [chatRun, setChatRun] = useState<AgentRunResponse | null>(null);
  // Cache dashboard results by tab+role so re-opening a tab is instant (no recompute).
  const [dashCache, setDashCache] = useState<Record<string, AgentRunResponse>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [dashMenuOpen, setDashMenuOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [showInspect, setShowInspect] = useState(false);
  const sessionRef = useRef<string | null>(null);

  const refreshHealth = () => api.health().then(setHealth).catch(() => {});
  useEffect(() => {
    refreshHealth();
  }, []);

  // Called after an upload or config reload — invalidate cached dashboards so they recompute.
  const onDataChanged = () => {
    setDashCache({});
    clearExecCache();
    refreshHealth();
  };

  const ask = async (question: string) => {
    setPendingQuestion(question);
    setLoading(true);
    setError(null);
    try {
      const res = await api.chat(question, role, sessionRef.current);
      sessionRef.current = res.session_id;
      setChatRun(res);
      setRun(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fetch a dashboard (territory/capacity), cached by tab+role. `force` re-computes.
  const loadDashboard = (force = false) => {
    if (mode !== "territory" && mode !== "capacity") return;
    const key = `${mode}:${role}`;
    if (!force && dashCache[key]) {
      setRun(dashCache[key]);
      setError(null);
      return;
    }
    setLoading(true);
    const fetcher = mode === "territory" ? api.territoryEquity(role) : api.capacityOverview(role);
    fetcher
      .then((res) => {
        setRun(res);
        setDashCache((c) => ({ ...c, [key]: res }));
        setError(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  // On tab / role change: show the chat result in ask mode, or the (cached) dashboard.
  useEffect(() => {
    if (mode === "ask") {
      if (chatRun) setRun(chatRun);
      return;
    }
    if (mode === "executive" || mode === "platform") return; // self-load / no run
    loadDashboard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, role]);

  // When the role changes, re-mask the existing chat answer INSTANTLY (deterministic —
  // no Claude call) so names/emails update immediately, keeping the written narrative.
  useEffect(() => {
    if (mode !== "ask" || !chatRun) return;
    api
      .chat(chatRun.question, role, sessionRef.current, false)
      .then((res) => {
        const updated = { ...chatRun, report: res.report, trace: res.trace };
        setChatRun(updated);
        setRun(updated);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="min-h-screen">
      <VoiantHeader health={health} role={role} onRole={setRole} onHelp={() => setShowHelp(true)} />
      {showHelp && <HelpGlossary onClose={() => setShowHelp(false)} />}

      {/* Mode switcher — Conversational · Dashboards ▾ · Behind the Scenes */}
      <nav className="relative border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-stretch gap-1 px-6">
          <NavTab active={mode === "ask"} onClick={() => setMode("ask")} title={TAB_HELP.ask}>
            Conversational
          </NavTab>

          {/* Dashboards dropdown */}
          <div className="relative">
            <NavTab
              active={DASH_MODES.includes(mode)}
              onClick={() => setDashMenuOpen((o) => !o)}
              title="Pre-built dashboards"
            >
              Dashboards{DASH_MODES.includes(mode) ? ` · ${TITLES[mode].title}` : ""}
              <span className="ml-1 text-[10px]">▾</span>
            </NavTab>
            {dashMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDashMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 w-64 overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-xl">
                  {DASH_TABS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        setMode(d.id);
                        setDashMenuOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left transition hover:bg-slate-50 ${
                        mode === d.id ? "bg-cyan-50/50" : ""
                      }`}
                    >
                      <div className={`text-sm font-semibold ${mode === d.id ? "text-brand-dark" : "text-navy"}`}>
                        {d.label}
                      </div>
                      <div className="text-[11px] text-slatebody">{d.sub}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <NavTab active={mode === "platform"} onClick={() => setMode("platform")} title={TAB_HELP.platform}>
            Behind the Scenes
          </NavTab>

          <NavTab active={mode === "config"} onClick={() => setMode("config")} title={TAB_HELP.config}>
            Configuration
          </NavTab>
        </div>
      </nav>

      {/* Page title band */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">{TITLES[mode].eyebrow}</div>
              <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-navy">
                {TITLES[mode].title}
              </h1>
              <p className="text-xs text-slatebody">{TITLES[mode].sub}</p>
            </div>
            {(mode === "territory" || mode === "capacity") && (
              <button
                onClick={() => loadDashboard(true)}
                disabled={loading}
                className="btn-ghost shrink-0 py-1.5 text-xs"
                title="Recompute this dashboard"
              >
                ↻ Refresh
              </button>
            )}
          </div>
          <div className="mt-3">
            <RoleBanner role={role} />
          </div>
        </div>
      </div>

      <main
        className={`mx-auto grid max-w-[1400px] gap-4 px-6 py-5 ${
          mode === "config" ? "" : "lg:grid-cols-[1fr_340px]"
        }`}
      >
        <div className="space-y-4">
          {mode === "ask" && <ChatPanel onAsk={ask} loading={loading} run={chatRun} />}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error} — is the backend running?
            </div>
          )}

          {mode === "config" ? (
            <ConfigPage role={role} onChanged={onDataChanged} />
          ) : mode === "platform" ? (
            <BehindTheScenes role={role} />
          ) : mode === "executive" ? (
            <ExecutiveSummary role={role} />
          ) : loading ? (
            mode === "ask" ? <ThinkingIndicator question={pendingQuestion} /> : <DashboardLoader />
          ) : run ? (
            <>
              {mode === "ask" && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-cyan-50/50 px-3 py-2 text-sm">
                  <span className="text-navy">
                    {DASH_FOR[run.report_type] ? (
                      <>
                        Answered by the <b>{DASH_FOR[run.report_type].agent}</b> agent
                      </>
                    ) : (
                      <>Answered</>
                    )}
                    {run.trace?.routing?.confidence != null && (
                      <span className="ml-1 text-slatebody">
                        · classified by model, {Math.round(Number(run.trace.routing.confidence) * 100)}% confident
                        {run.trace.routing.reason && (
                          <span className="italic"> — “{run.trace.routing.reason}”</span>
                        )}
                      </span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <button className="btn-ghost py-1.5 text-xs" onClick={() => setShowInspect((s) => !s)}>
                      🔍 {showInspect ? "Hide" : "Technical"} details
                    </button>
                    {DASH_FOR[run.report_type] && (
                      <button
                        className="btn-ghost py-1.5 text-xs"
                        onClick={() => setMode(DASH_FOR[run.report_type].mode)}
                      >
                        Open {DASH_FOR[run.report_type].label} →
                      </button>
                    )}
                  </div>
                </div>
              )}
              {mode === "ask" && run.memory && run.memory.length > 1 && (
                <MemoryStrip memory={run.memory} />
              )}
              {mode === "ask" && showInspect && <InspectPanel run={run} />}
              <ResultRenderer run={run} />
              {mode === "ask" && <AssumptionsFooter run={run} />}
            </>
          ) : (
            <div className="card p-8 text-center text-sm text-slatebody">
              {mode === "ask"
                ? "Ask a question above to run the agents on the synthetic dataset."
                : "Loading dashboard…"}
            </div>
          )}
        </div>

        {mode !== "config" && (
          <aside className="space-y-4">
            <ConfigLedgerPanel onReload={onDataChanged} role={role} />
            <UploadControl onIngested={onDataChanged} role={role} />
            <GovernanceTrail run={run} />
          </aside>
        )}
      </main>

      <footer className="mx-auto flex max-w-[1400px] flex-col items-center gap-2.5 px-6 pb-10 pt-4 text-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Powered by</span>
        <img
          src="/brightcone-wordmark.webp"
          alt="brightcone.ai — Clarity. Focus. Impact"
          className="h-11 w-auto"
        />
        <div className="text-xs text-slate-400">
          Voiant Sales Planning Intelligence · Governance-first agentic AI · Synthetic data only
        </div>
      </footer>
    </div>
  );
}

function MemoryStrip({ memory }: { memory: { question: string; agent: string }[] }) {
  const AGENT_LABEL: Record<string, string> = {
    quota_equity: "Quota Equity",
    capacity_headroom: "Capacity Headroom",
    scenario_orchestrator: "Orchestrator",
  };
  return (
    <div className="rounded-xl border border-brand/20 bg-gradient-to-r from-cyan-50/60 to-white px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">🧠</span>
        <span className="font-display text-[11px] font-bold uppercase tracking-wide text-navy">
          Conversation memory
        </span>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
          {memory.length} turn{memory.length === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">this session only · not stored in DB</span>
      </div>
      <ol className="space-y-1">
        {memory.map((m, i) => {
          const current = i === memory.length - 1;
          return (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                  current ? "bg-brand text-white" : "bg-slate-200 text-navy"
                }`}
              >
                {i + 1}
              </span>
              <span className={`truncate ${current ? "font-medium text-navy" : "text-slatebody"}`}>
                {m.question}
              </span>
              <span className="ml-auto shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-brand-dark ring-1 ring-brand/20">
                {AGENT_LABEL[m.agent] ?? m.agent}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NavTab({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`-mb-px flex items-center border-b-2 px-4 py-3 font-display text-xs font-bold uppercase tracking-[0.1em] transition ${
        active ? "border-brand text-navy" : "border-transparent text-slatebody hover:text-navy"
      }`}
    >
      {children}
    </button>
  );
}

function DashboardLoader() {
  return (
    <div className="card flex items-center gap-3 p-5 text-sm text-slatebody">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
      Computing dashboard… <span className="text-slate-400">(deterministic — no AI call)</span>
    </div>
  );
}

function UploadControl({ onIngested, role }: { onIngested: () => void; role: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const readOnly = role === "viewer";

  const onFile = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.uploadCsv(file, true);
      setMsg(`Ingested ${res.rows} rows via Shield (${res.shield_status}); ${res.entities_detected} entities detected.`);
      onIngested();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="panel-title mb-2">Secure Ingestion (CSV / Excel)</div>
      <input
        ref={ref}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button
        className="btn-ghost w-full justify-center"
        onClick={() => ref.current?.click()}
        disabled={busy || readOnly}
      >
        {readOnly ? "🔒 Upload disabled for Viewer" : busy ? "Masking through Shield…" : "Upload & mask through Shield"}
      </button>
      {msg && <div className="mt-2 text-[11px] text-slatebody">{msg}</div>}
      <div className="mt-2 text-[11px] text-slate-400">
        {readOnly
          ? "Viewer is read-only. Switch to Admin or Analyst to ingest data."
          : "PII fields are detected by Bright Shield and replaced with stable tokens before analysis."}
      </div>
    </div>
  );
}
