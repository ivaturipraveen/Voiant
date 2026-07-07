import { useEffect, useRef, useState } from "react";
import {
  api,
  type AgentRunResponse,
  type Assumption,
  type CapacityReport,
  type ExecutiveSummaryResponse,
  type Health,
  type QuotaEquityReport,
} from "./api";
import AppHeader from "./components/AppHeader";
import AuditLogPage from "./components/AuditLogPage";
import BehindTheScenes from "./components/BehindTheScenes";
import ChatPanel from "./components/ChatPanel";
import ConfigPage from "./components/ConfigPage";
import LoginPage from "./components/LoginPage";
import { AssumptionsFooter } from "./components/GovernancePanels";
import InspectPanel from "./components/InspectPanel";
import ResultRenderer from "./components/ResultRenderer";
import RightRail from "./components/RightRail";
import Sidebar, { type Mode } from "./components/Sidebar";
import ThinkingIndicator from "./components/ThinkingIndicator";
import CapacityPage from "./components/dashboards/CapacityPage";
import ExecutivePage from "./components/dashboards/ExecutivePage";
import TerritoryEquityPage from "./components/dashboards/TerritoryEquityPage";

const AGENT_LABEL: Record<string, string> = {
  quota_equity: "Quota Equity",
  capacity_headroom: "Capacity Headroom",
  synthesis: "Scenario Orchestrator",
  scenario_orchestrator: "Scenario Orchestrator",
};

// The user's message, right-aligned like a chat bubble.
function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <span className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-3.5 py-2 text-[13px] font-medium text-white">
        {text}
      </span>
    </div>
  );
}

type DashEntry = {
  fetchedAt: Date;
  runId: string | null;
  assumptions: Assumption[];
  territory?: QuotaEquityReport;
  capacity?: CapacityReport;
  exec?: ExecutiveSummaryResponse;
};

const DASH_MODES: Mode[] = ["territory", "capacity", "executive"];

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => sessionStorage.getItem("voiant_authed") === "1");
  const [health, setHealth] = useState<Health | null>(null);
  const [role, setRole] = useState("admin");

  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Mode) || "territory";
  const [mode, setMode] = useState<Mode>(
    ["ask", "territory", "capacity", "executive", "platform", "config", "audit"].includes(initialTab)
      ? initialTab
      : "territory"
  );

  // Conversational state
  const [chatRun, setChatRun] = useState<AgentRunResponse | null>(null);
  const [chatHistory, setChatHistory] = useState<AgentRunResponse[]>([]); // conversation thread
  const [loading, setLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [showInspect, setShowInspect] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const lastTurnRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  // When a new turn arrives, bring the top of that answer into view (comfortable reading start).
  useEffect(() => {
    if (chatHistory.length > 0) {
      lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [chatHistory.length]);
  // The moment a question is sent, scroll to it (question bubble + thinking) so it's visible.
  useEffect(() => {
    if (loading) pendingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  // Dashboard state (fetched from the report endpoints, cached by mode+role)
  const dashCache = useRef<Record<string, DashEntry>>({});
  const [dash, setDash] = useState<DashEntry | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [shieldBusy, setShieldBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile nav drawer (< lg)

  const refreshHealth = () => api.health().then(setHealth).catch(() => {});
  useEffect(() => {
    refreshHealth();
  }, []);

  const loadDash = async (m: Mode, r: string) => {
    const key = `${m}:${r}`;
    const cached = dashCache.current[key];
    if (cached) {
      setDash(cached);
      return;
    }
    setDashLoading(true);
    setError(null);
    try {
      let entry: DashEntry;
      if (m === "territory") {
        const res = await api.territoryEquity(r);
        const rep = res.report as QuotaEquityReport;
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: rep.assumptions ?? [], territory: rep };
      } else if (m === "capacity") {
        const res = await api.capacityOverview(r);
        const rep = res.report as CapacityReport;
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: rep.assumptions ?? [], capacity: rep };
      } else {
        const res = await api.executiveSummary(r);
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: [], exec: res };
      }
      dashCache.current[key] = entry;
      setDash(entry);
    } catch (e) {
      setError(String(e));
    } finally {
      setDashLoading(false);
    }
  };

  // Load / refresh the active dashboard when the mode or role changes.
  useEffect(() => {
    if (DASH_MODES.includes(mode)) loadDash(mode, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, role]);

  const onDataChanged = () => {
    dashCache.current = {};
    refreshHealth();
    if (DASH_MODES.includes(mode)) loadDash(mode, role);
  };

  const remaskCurrent = async () => {
    if (!chatRun) return;
    try {
      const res = await api.chat(chatRun.question, role, sessionRef.current, false);
      const updated = { ...chatRun, report: res.report, trace: res.trace };
      setChatRun(updated);
      // reflect the re-masked answer in the latest thread turn
      setChatHistory((h) => (h.length ? [...h.slice(0, -1), updated] : h));
    } catch {
      /* keep view */
    }
  };
  useEffect(() => {
    remaskCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const onToggleShield = async (enabled: boolean) => {
    setShieldBusy(true);
    try {
      await api.toggleShield(enabled);
      await refreshHealth();
      dashCache.current = {};
      if (DASH_MODES.includes(mode)) await loadDash(mode, role);
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
      setChatHistory((h) => [...h, res]); // keep the full conversation thread
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("voiant_authed");
    setAuthed(false);
  };

  // Login gate — all hooks above run unconditionally; this early return is after them.
  if (!authed) {
    return (
      <LoginPage
        onSuccess={() => {
          sessionStorage.setItem("voiant_authed", "1");
          setAuthed(true);
        }}
      />
    );
  }

  const isDash = DASH_MODES.includes(mode);
  const execCount = dashCache.current[`executive:${role}`]?.exec?.top_findings.length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa]">
      <AppHeader
        health={health}
        role={role}
        onRole={setRole}
        onToggleShield={onToggleShield}
        shieldBusy={shieldBusy}
        onMenu={() => setSidebarOpen(true)}
        onLogout={logout}
      />

      <div className="flex flex-1">
        <Sidebar
          mode={mode}
          onMode={setMode}
          badges={execCount != null ? { executive: execCount } : undefined}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1440px] px-6 py-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error} — is the backend running?
              </div>
            )}

            {isDash ? (
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="min-w-0 flex-1">
                  {dashLoading || !dash ? (
                    <DashSkeleton />
                  ) : mode === "territory" && dash.territory ? (
                    <TerritoryEquityPage report={dash.territory} />
                  ) : mode === "capacity" && dash.capacity ? (
                    <CapacityPage report={dash.capacity} />
                  ) : mode === "executive" && dash.exec ? (
                    <ExecutivePage data={dash.exec} />
                  ) : (
                    <DashSkeleton />
                  )}
                </div>
                <RightRail
                  assumptions={dash?.assumptions ?? []}
                  runId={dash?.runId ?? null}
                  onOpenAudit={() => setMode("audit")}
                />
              </div>
            ) : mode === "config" ? (
              <ConfigPage role={role} onChanged={onDataChanged} />
            ) : mode === "audit" ? (
              <AuditLogPage />
            ) : mode === "platform" ? (
              <BehindTheScenes role={role} />
            ) : (
              // Conversational — a single centered column that uses the full width
              <div className="mx-auto w-full max-w-4xl">
                <div className="min-w-0 space-y-5">
                  {chatHistory.length === 0 ? (
                    <>
                      <ChatPanel onAsk={ask} loading={loading} run={chatRun} />
                      {loading ? (
                        <div className="space-y-3">
                          {pendingQuestion && <QuestionBubble text={pendingQuestion} />}
                          <ThinkingIndicator question={pendingQuestion} />
                        </div>
                      ) : (
                        <div className="card grid place-items-center p-14 text-center">
                          <div className="max-w-sm">
                            <p className="text-sm font-medium text-navy">Ask a question to begin</p>
                            <p className="mt-1 text-[13px] text-slatebody">
                              The matching analysis opens with your answer. Follow-up questions keep the
                              context — ask “why?” or “what about the West?” and it stays on topic.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                    <div className="space-y-6">
                      {chatHistory.map((turn, i) => {
                        const isLast = i === chatHistory.length - 1;
                        return (
                          <div
                            key={turn.run_id + i}
                            ref={isLast ? lastTurnRef : undefined}
                            className="scroll-mt-20 space-y-3"
                          >
                            <QuestionBubble text={turn.question} />
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                              <span className="text-navy">
                                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" />
                                Answered by the <b>{AGENT_LABEL[turn.report_type] ?? "agent"}</b>
                                {turn.trace?.routing?.confidence != null && (
                                  <span className="ml-1 text-slatebody">
                                    · {Math.round(Number(turn.trace.routing.confidence) * 100)}% confident
                                  </span>
                                )}
                                {i > 0 && turn.routed_from && (
                                  <span className="ml-1 text-slatebody">· follow-up</span>
                                )}
                              </span>
                              {isLast && (
                                <button className="btn-ghost py-1.5 text-xs" onClick={() => setShowInspect((s) => !s)}>
                                  {showInspect ? "Hide" : "Technical"} details
                                </button>
                              )}
                            </div>
                            {isLast && showInspect && <InspectPanel run={turn} />}
                            <ResultRenderer run={turn} />
                            {isLast && <AssumptionsFooter run={turn} />}
                          </div>
                        );
                      })}
                      {loading && (
                        <div ref={pendingRef} className="scroll-mt-20 space-y-3">
                          {pendingQuestion && <QuestionBubble text={pendingQuestion} />}
                          <ThinkingIndicator question={pendingQuestion} />
                        </div>
                      )}
                    </div>
                    {/* Composer docks to the bottom of the viewport — always reachable while
                        scrolling the thread, like a real chat. The thread fades out behind it. */}
                    <div className="sticky bottom-0 z-20 -mx-1 bg-gradient-to-t from-[#f7f8fa] via-[#f7f8fa]/95 to-transparent px-1 pb-2 pt-4">
                      <ChatPanel onAsk={ask} loading={loading} run={chatRun} docked />
                    </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-400">
        Voiant Sales Planning Intelligence · Governance-first agentic AI · Synthetic data only
      </footer>
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 flex-1 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-slate-200/60" />
    </div>
  );
}
