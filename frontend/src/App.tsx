import { type ReactNode, useEffect, useRef, useState } from "react";
import { api, type AgentRunResponse, type Health } from "./api";
import BehindTheScenes from "./components/BehindTheScenes";
import ChatPanel from "./components/ChatPanel";
import ConfigPage from "./components/ConfigPage";
import HelpGlossary from "./components/HelpGlossary";
import InspectPanel from "./components/InspectPanel";
import { AssumptionsFooter, ConfigLedgerPanel, GovernanceTrail } from "./components/GovernancePanels";
import ResultRenderer from "./components/ResultRenderer";
import RoleBanner from "./components/RoleBanner";
import Sidebar from "./components/Sidebar";
import ThinkingIndicator from "./components/ThinkingIndicator";
import Topbar from "./components/Topbar";

type Mode = "ask" | "platform" | "config";

// Top-level nav is 3 items. The dashboards are NOT separate tabs — asking a question
// renders the matching dashboard inline (quota → Territory, capacity → Capacity, a
// question spanning both → both), so the conversational view is the single home.
const TITLES: Record<Mode, { eyebrow: string; title: string; sub: string }> = {
  ask: { eyebrow: "Conversational", title: "Ask Voiant Intelligence", sub: "Ask in plain English — the right dashboard opens with your answer" },
  platform: { eyebrow: "Technical", title: "Behind the Scenes", sub: "Agents, pipeline, Shield, model routing & audit — live" },
  config: { eyebrow: "Client setup", title: "Configuration", sub: "The interpretation rules the agents apply — view & tune live" },
};

const TAB_HELP: Record<Mode, string> = {
  ask: "Ask any sales-planning question in plain English",
  platform: "Technical view: agents, pipeline, Shield & audit",
  config: "Client configuration — view & tune the rules live",
};

// Human label for the agent that answered (shown above the inline result).
const AGENT_LABEL: Record<string, string> = {
  quota_equity: "Quota Equity",
  capacity_headroom: "Capacity Headroom",
  synthesis: "Scenario Orchestrator",
  scenario_orchestrator: "Scenario Orchestrator",
};

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  // Default to admin so the demo shows real rep names first; switch down to
  // analyst / viewer to demonstrate PII masking.
  const [role, setRole] = useState("admin");
  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Mode) || "ask";
  const [mode, setMode] = useState<Mode>(
    ["ask", "platform", "config"].includes(initialTab) ? initialTab : "ask"
  );
  const [run, setRun] = useState<AgentRunResponse | null>(null); // last conversational run (drives the governance trail)
  const [chatRun, setChatRun] = useState<AgentRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [showInspect, setShowInspect] = useState(false);
  const sessionRef = useRef<string | null>(null);

  const refreshHealth = () => api.health().then(setHealth).catch(() => {});
  useEffect(() => {
    refreshHealth();
  }, []);

  // Called after an upload or config reload — refresh state.
  const onDataChanged = () => {
    refreshHealth();
  };

  // Re-run the current question deterministically (no Claude) to refresh masking/report.
  const remaskCurrent = async () => {
    if (!chatRun) return;
    try {
      const res = await api.chat(chatRun.question, role, sessionRef.current, false);
      const updated = { ...chatRun, report: res.report, trace: res.trace };
      setChatRun(updated);
      setRun(updated);
    } catch {
      /* keep the current view */
    }
  };

  const [shieldBusy, setShieldBusy] = useState(false);
  const onToggleShield = async (enabled: boolean) => {
    setShieldBusy(true);
    try {
      await api.toggleShield(enabled);
      await refreshHealth();
      await remaskCurrent();
    } catch (e) {
      setError(String(e));
    } finally {
      setShieldBusy(false);
    }
  };

  const ask = async (question: string) => {
    setMode("ask");
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

  // When the role changes, re-mask the existing answer instantly (deterministic — no Claude)
  // so names/emails update immediately, keeping the written narrative.
  useEffect(() => {
    remaskCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <div className="flex min-h-screen">
      <Sidebar mode={mode} onMode={setMode} health={health} />
      {showHelp && <HelpGlossary onClose={() => setShowHelp(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          eyebrow={TITLES[mode].eyebrow}
          title={TITLES[mode].title}
          sub={TITLES[mode].sub}
          health={health}
          role={role}
          onRole={setRole}
          onHelp={() => setShowHelp(true)}
          onToggleShield={onToggleShield}
          shieldBusy={shieldBusy}
        />

        {/* Mobile nav — sidebar is hidden below lg */}
        <nav className="flex items-stretch gap-1 border-b border-slate-200 bg-white px-4 lg:hidden">
          <NavTab active={mode === "ask"} onClick={() => setMode("ask")} title={TAB_HELP.ask}>
            Conversational
          </NavTab>
          <NavTab active={mode === "platform"} onClick={() => setMode("platform")} title={TAB_HELP.platform}>
            Behind the Scenes
          </NavTab>
          <NavTab active={mode === "config"} onClick={() => setMode("config")} title={TAB_HELP.config}>
            Configuration
          </NavTab>
        </nav>

        <main
          className={`grid w-full max-w-[1440px] gap-5 px-6 py-6 ${
            mode === "ask" ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""
          }`}
        >
          <div className="min-w-0 space-y-5">
            {mode === "ask" && (
              <>
                <RoleBanner role={role} />
                <ChatPanel onAsk={ask} loading={loading} run={chatRun} />
              </>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error} — is the backend running?
              </div>
            )}

            {mode === "config" ? (
              <ConfigPage role={role} onChanged={onDataChanged} />
            ) : mode === "platform" ? (
              <BehindTheScenes role={role} />
            ) : loading ? (
              <ThinkingIndicator question={pendingQuestion} />
            ) : run ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <span className="text-navy">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />
                    Answered by the <b>{AGENT_LABEL[run.report_type] ?? "agent"}</b>
                    {run.trace?.routing?.confidence != null && (
                      <span className="ml-1 text-slatebody">
                        · {Math.round(Number(run.trace.routing.confidence) * 100)}% confident
                        {run.trace.routing.reason && (
                          <span className="italic"> — “{run.trace.routing.reason}”</span>
                        )}
                      </span>
                    )}
                  </span>
                  <button className="btn-ghost py-1.5 text-xs" onClick={() => setShowInspect((s) => !s)}>
                    {showInspect ? "Hide" : "Technical"} details
                  </button>
                </div>
                {run.memory && run.memory.length > 1 && <MemoryStrip memory={run.memory} />}
                {showInspect && <InspectPanel run={run} />}
                <ResultRenderer run={run} />
                <AssumptionsFooter run={run} />
              </>
            ) : (
              <div className="card grid place-items-center p-14 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-brand-dark">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-navy">Ask a question to begin</p>
                  <p className="mt-1 text-[13px] text-slatebody">
                    The matching dashboard opens inline with your answer.
                  </p>
                </div>
              </div>
            )}
          </div>

          {mode === "ask" && (
            <aside className="space-y-5">
              <ConfigLedgerPanel onReload={onDataChanged} role={role} />
              <UploadControl onIngested={onDataChanged} role={role} />
              <GovernanceTrail run={run} />
            </aside>
          )}
        </main>

        <footer className="mt-auto border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-400">
          Voiant Sales Planning Intelligence · Governance-first agentic AI · Synthetic data only
        </footer>
      </div>
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-display text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Conversation memory
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slatebody">
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
