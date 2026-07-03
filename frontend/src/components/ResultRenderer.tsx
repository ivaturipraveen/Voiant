import type { AgentRunResponse } from "../api";
import CapacityView from "./CapacityView";
import QuotaEquityView from "./QuotaEquityView";
import { NarrativeCard } from "./Shared";

// Renders an agent run according to its report_type. Synthesis reuses both agent
// views (with their narratives hidden) under the combined orchestrator narrative.
export default function ResultRenderer({ run }: { run: AgentRunResponse }) {
  if (run.report_type === "quota_equity") return <QuotaEquityView run={run} />;
  if (run.report_type === "capacity_headroom") return <CapacityView run={run} />;

  if (run.report_type === "synthesis") {
    const reports = run.report.reports ?? {};
    const qeRun = reports.quota_equity
      ? { ...run, report: reports.quota_equity, report_type: "quota_equity" }
      : null;
    const capRun = reports.capacity_headroom
      ? { ...run, report: reports.capacity_headroom, report_type: "capacity_headroom" }
      : null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slatebody">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Scenario Orchestrator synthesized this answer across {run.report.agents?.join(" + ")}.
        </div>
        <NarrativeCard narrative={run.narrative} source={run.narrative_source} hash={run.determinism_hash} />
        {qeRun && <QuotaEquityView run={qeRun} hideNarrative />}
        {capRun && <CapacityView run={capRun} hideNarrative />}
      </div>
    );
  }

  return <NarrativeCard narrative={run.narrative} source={run.narrative_source} hash={run.determinism_hash} />;
}
