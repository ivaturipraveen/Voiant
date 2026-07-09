import { useEffect, useRef, useState } from "react";
import {
  api,
  type AgentRunResponse,
  type Assumption,
  type CapacityReport,
  type ClientConfig,
  type ExecutiveSummaryResponse,
  type Health,
  type QuotaEquityReport,
} from "./api";
import AnalyticalQA from "./components/AnalyticalQA";
import AuditLogPage from "./components/AuditLogPage";
import BehindTheScenes from "./components/BehindTheScenes";
import ConfigPage from "./components/ConfigPage";
import ExecutiveReport from "./components/ExecutiveReport";
import LoginPage from "./components/LoginPage";
import RecommendationsReport from "./components/RecommendationsReport";
import ReportHeader from "./components/ReportHeader";
import ReportMasthead from "./components/ReportMasthead";
import ReportTabs from "./components/ReportTabs";
import { type Mode } from "./components/Sidebar";
import CapacityReportView from "./components/CapacityReport";
import TerritoryReport from "./components/TerritoryReport";

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
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [role, setRole] = useState("admin");

  const initialTab = (new URLSearchParams(window.location.search).get("tab") as Mode) || "executive";
  const [mode, setMode] = useState<Mode>(
    ["ask", "territory", "capacity", "executive", "recommendations", "platform", "config", "audit"].includes(initialTab)
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

  const refreshHealth = () => api.health().then(setHealth).catch(() => {});
  useEffect(() => {
    refreshHealth();
    api.config().then(setConfig).catch(() => setConfig(null));
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
    api.config().then(setConfig).catch(() => {});
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

  const execCount = dashCache.current[`executive:${role}`]?.exec?.top_findings.length;
  const previewDate = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex min-h-screen flex-col bg-[#f9fafb]">
      <ReportHeader
        health={health}
        role={role}
        onRole={setRole}
        onToggleShield={onToggleShield}
        shieldBusy={shieldBusy}
        onOpenConfig={() => setMode("config")}
        onLogout={logout}
        preview={previewDate}
      />

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <ReportMasthead
            health={health}
            rulesetsCount={config?.interpretation_rules?.length}
            segmentCount={config?.segment_definitions?.length}
          />

          <ReportTabs
            mode={mode}
            onMode={setMode}
            onExport={() => window.print()}
            execBadge={execCount}
          />

          <div className="py-7">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error} — is the backend running?
              </div>
            )}

            {mode === "executive" ? (
              dashLoading || !dash?.exec ? (
                <DashSkeleton />
              ) : (
                <ExecutiveReport data={dash.exec} health={health} />
              )
            ) : mode === "recommendations" ? (
              <RecommendationsReport role={role} />
            ) : mode === "territory" ? (
              dashLoading || !dash?.territory ? (
                <DashSkeleton />
              ) : (
                <TerritoryReport report={dash.territory} />
              )
            ) : mode === "capacity" ? (
              dashLoading || !dash?.capacity ? (
                <DashSkeleton />
              ) : (
                <CapacityReportView report={dash.capacity} />
              )
            ) : mode === "config" ? (
              <ConfigPage role={role} onChanged={onDataChanged} />
            ) : mode === "audit" ? (
              <AuditLogPage />
            ) : mode === "platform" ? (
              <BehindTheScenes role={role} />
            ) : (
              <div className="mx-auto w-full max-w-4xl">
                <AnalyticalQA
                  chatHistory={chatHistory}
                  loading={loading}
                  pendingQuestion={pendingQuestion}
                  onAsk={ask}
                  chatRun={chatRun}
                  showInspect={showInspect}
                  onToggleInspect={() => setShowInspect((s) => !s)}
                  lastTurnRef={lastTurnRef}
                  pendingRef={pendingRef}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-[11px] text-slate-400 sm:px-8">
          <span>
            <span className="font-semibold tracking-wide text-brand-dark">VOIANT</span>
            <span className="mx-2 text-slate-300">·</span>
            Sales Planning Intelligence
            <span className="mx-2 text-slate-300">·</span>
            Preview build v0.4
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              Delivered by <span className="font-semibold text-navy">Brightcone</span>
            </span>
            <span className="text-slate-300">·</span>
            <span>Two-tier secure ingestion</span>
            <span className="text-slate-300">·</span>
            <span>SOC 2 Type 2 aligned</span>
            <span className="text-slate-300">·</span>
            <span>Anthropic Claude inference</span>
          </span>
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
