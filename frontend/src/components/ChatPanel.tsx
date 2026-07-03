import { useState } from "react";
import type { AgentRunResponse } from "../api";

const SUGGESTIONS = [
  "Is each rep's quota fair given their territory's opportunity?",
  "How much more quota can the team carry?",
  "What if we cut 3 reps?",
  "Give me the big-picture overview.",
];

export default function ChatPanel({
  onAsk,
  loading,
  run,
}: {
  onAsk: (q: string) => void;
  loading: boolean;
  run: AgentRunResponse | null;
}) {
  const [q, setQ] = useState(SUGGESTIONS[0]);

  const submit = (text: string) => {
    if (!text.trim() || loading) return;
    onAsk(text.trim());
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 transition focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(q)}
          placeholder="Ask a sales-planning question…"
          className="flex-1 bg-transparent py-1.5 text-sm text-navy outline-none placeholder:text-slate-400"
        />
        <button className="btn-primary shrink-0 py-1.5" onClick={() => submit(q)} disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-slate-400">
          {run ? "Follow-ups" : "Try"}
        </span>
        {(run?.suggested_followups ?? SUGGESTIONS).slice(0, 4).map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              submit(s);
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slatebody transition hover:border-brand hover:bg-brand/5 hover:text-brand-dark"
          >
            {s}
          </button>
        ))}
      </div>

      {run && (
        <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
          Routed to <b className="font-semibold text-slatebody">{run.agent}</b> ({run.routed_from}) · run{" "}
          <span className="font-mono">{run.run_id}</span>
        </div>
      )}
    </div>
  );
}
