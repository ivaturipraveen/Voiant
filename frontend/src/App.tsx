import { useEffect, useRef, useState } from "react";
import {
  api,
  type AgentRunResponse,
  type Assumption,
  type CapacityReport,
  type ExecutiveSummaryResponse,
  type Health,
  type QuotaEquityReport,
  type RecommendationsReport,
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
import type { Mode } from "./components/Sidebar";
import PageHeaderNav from "./components/PageHeaderNav";
import ThinkingIndicator from "./components/ThinkingIndicator";
import CapacityPage from "./components/dashboards/CapacityPage";
import ExecutivePage from "./components/dashboards/ExecutivePage";
import RecommendationsPage from "./components/dashboards/RecommendationsPage";
import TerritoryEquityPage from "./components/dashboards/TerritoryEquityPage";

const AGENT_LABEL: Record<string, string> = {
  quota_equity: "Quota Equity",
  capacity_headroom: "Capacity Headroom",
  synthesis: "Scenario Orchestrator",
  scenario_orchestrator: "Scenario Orchestrator",
};

function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 border-l-[3px] border-[#4a77b4] pl-4 pt-1 pb-1">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#4a77b4]">QUESTION</span>
      <span className="text-[16px] font-medium text-navy">{text}</span>
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
  recommendations?: RecommendationsReport;
  narrative?: string;
};

const DASH_MODES: Mode[] = ["territory", "capacity", "executive", "recommendations"];

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => sessionStorage.getItem("voiant_authed") === "1");
  const [currentUser, setCurrentUser] = useState<string>(() => sessionStorage.getItem("voiant_user") || "Sarah Coleman");
  const [health, setHealth] = useState<Health | null>(null);
  const [role, setRole] = useState("admin");

  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Mode) || "executive";
  const [mode, setMode] = useState<Mode>(
    ["ask", "territory", "capacity", "executive", "platform", "config", "audit"].includes(initialTab)
      ? initialTab
      : "executive"
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

  const refreshHealth = () => api.health().then(setHealth).catch(() => { });
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
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: rep.assumptions ?? [], territory: rep, narrative: res.narrative };
      } else if (m === "capacity") {
        const res = await api.capacityOverview(r);
        const rep = res.report as CapacityReport;
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: rep.assumptions ?? [], capacity: rep, narrative: res.narrative };
      } else if (m === "recommendations") {
        const res = await api.recommendationsOverview(r);
        const rep = res.report as RecommendationsReport;
        entry = { fetchedAt: new Date(), runId: res.run_id, assumptions: [], recommendations: rep };
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
    sessionStorage.removeItem("voiant_user");
    setAuthed(false);
  };

  // Login gate — all hooks above run unconditionally; this early return is after them.
  if (!authed) {
    return (
      <LoginPage
        onSuccess={(user) => {
          sessionStorage.setItem("voiant_authed", "1");
          sessionStorage.setItem("voiant_user", user);
          setCurrentUser(user);
          setAuthed(true);
        }}
      />
    );
  }

  const isDash = DASH_MODES.includes(mode);
  const execCount = dashCache.current[`executive:${role}`]?.exec?.top_findings.length;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fa] overflow-x-hidden w-full max-w-full">
      <AppHeader
        health={health}
        role={role}
        onRole={setRole}
        onToggleShield={onToggleShield}
        shieldBusy={shieldBusy}
        onMenu={() => setSidebarOpen(true)}
        onLogout={logout}
        currentUser={currentUser}
      />

      <div className="flex flex-1 flex-col px-6 md:px-8 overflow-x-hidden w-full max-w-full">
        <PageHeaderNav
          mode={mode}
          onMode={setMode}
          exportData={
            mode === "territory"
              ? dash?.territory
              : mode === "capacity"
                ? dash?.capacity
                : mode === "recommendations"
                  ? dash?.recommendations
                  : mode === "executive"
                    ? dash?.exec
                    : mode === "ask"
                      ? (chatRun ?? { section: "Analytical Q&A", note: "No analysis run yet." })
                      : mode === "audit"
                        ? { section: "Audit Log", generated: new Date().toISOString() }
                        : mode === "config"
                          ? { section: "Configuration", generated: new Date().toISOString() }
                          : chatRun
          }
          metadata={dashCache.current[`executive:${role}`]?.exec?.page_metadata || dash?.exec?.page_metadata}
        />
        <main className="min-w-0 flex-1">
          <div className="pb-6">
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
                    <TerritoryEquityPage report={dash.territory} narrative={dash.narrative} onOpenAudit={() => setMode("audit")} />
                  ) : mode === "capacity" && dash.capacity ? (
                    <CapacityPage report={dash.capacity} narrative={dash.narrative} onOpenAudit={() => setMode("audit")} />
                  ) : mode === "recommendations" && dash.recommendations ? (
                    <RecommendationsPage report={dash.recommendations} />
                  ) : mode === "executive" && dash.exec ? (
                    <ExecutivePage data={dash.exec} onOpenAudit={() => setMode("audit")} />
                  ) : (
                    <DashSkeleton />
                  )}
                </div>
                {!DASH_MODES.includes(mode) && (
                  <RightRail
                    assumptions={dash?.assumptions ?? []}
                    runId={dash?.runId ?? null}
                    onOpenAudit={() => setMode("audit")}
                  />
                )}
              </div>
            ) : mode === "config" ? (
              <ConfigPage role={role} onChanged={onDataChanged} />
            ) : mode === "recommendations" ? (
              <RecommendationsPage />
            ) : mode === "audit" ? (
              <AuditLogPage />
            ) : mode === "platform" ? (
              <BehindTheScenes role={role} />
            ) : (
              // Conversational Q&A View
              <div className="w-full pb-12">
                <div className="flex items-center justify-between mb-4 mt-2 px-2">
                  <h3 className="font-display text-[17px] font-medium text-navy">
                    <span className="mr-2 text-[#4a77b4]">§ 05</span> Analytical Q&A
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    Natural-language interrogation of the underlying model · Sources cited in every response
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[500px] md:h-[700px]">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between bg-[#c6654b] px-6 py-3 text-white">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90"></span>
                      Ask Voiant
                    </div>
                    <div className="text-[10px] text-white/90 tracking-wide">
                      Session · 24 Jun 2026 · 09:14 EDT
                    </div>
                  </div>

                  {/* Scrollable Chat Area */}
                  <div className="flex-1 overflow-y-auto p-8 relative">
                    {chatHistory.length === 0 && !loading ? (
                      <div className="flex h-full items-center justify-center text-center">
                        <div className="max-w-sm">
                          <p className="text-sm font-medium text-navy">Ask a question to begin</p>
                          <p className="mt-1 text-[13px] text-slatebody">
                            The matching analysis opens with your answer. Follow-up questions keep the
                            context — ask “why?” or “what about the West?” and it stays on topic.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-10">
                        {chatHistory.map((turn, i) => {
                          const isLast = i === chatHistory.length - 1;
                          return (
                            <div key={turn.run_id + i} ref={isLast ? lastTurnRef : undefined} className="space-y-6 scroll-mt-8">
                              <QuestionBubble text={turn.question} />

                              <div className="pl-6 border-l-2 border-slate-200/50">
                                <div className="mb-4 flex items-center gap-2">
                                  <span className="rounded bg-[#4a77b4] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                                    {AGENT_LABEL[turn.report_type]?.toUpperCase() ?? "AGENT"}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    Routed by {AGENT_LABEL.synthesis}
                                    {turn.trace?.routing?.confidence != null && ` · Cross-references TAM, deployed quota, and productivity`}
                                  </span>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-6 text-[13.5px] leading-relaxed text-slate-700">
                                  <ResultRenderer run={turn} />
                                </div>

                                {isLast && <div className="mt-4"><AssumptionsFooter run={turn} /></div>}
                                {isLast && (
                                  <div className="mt-3">
                                    <button className="text-[11px] font-semibold text-brand-dark hover:underline" onClick={() => setShowInspect((s) => !s)}>
                                      {showInspect ? "Hide" : "Technical"} details
                                    </button>
                                    {showInspect && <div className="mt-3"><InspectPanel run={turn} /></div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {loading && (
                          <div ref={pendingRef} className="scroll-mt-20 space-y-6">
                            {pendingQuestion && <QuestionBubble text={pendingQuestion} />}
                            <ThinkingIndicator question={pendingQuestion} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pinned Input */}
                  <div className="border-t border-slate-100 bg-white p-4">
                    <ChatPanel onAsk={ask} loading={loading} run={chatRun} docked />
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white px-10 py-5 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/image.png" alt="Voiant logo" className="h-5 w-5 object-contain" />
            <span className="font-bold uppercase tracking-wider text-[#4a77b4] text-[12px]">VOIANT</span>
            <span className="text-slate-300">·</span>
            <span>Sales Planning Intelligence - Preview build v0.4</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              Delivered by
              <img src="/brightcone-wordmark.webp" alt="Brightcone logo" className="h-[18px] object-contain" />
            </span>
            <span className="text-slate-300">·</span>
            <span>Two-tier secure ingestion</span>
            <span className="text-slate-300">·</span>
            <span>SOC 2 Type 2 aligned</span>
            <span className="text-slate-300">·</span>
            <span>Anthropic Claude inference</span>
          </div>
        </div>
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
