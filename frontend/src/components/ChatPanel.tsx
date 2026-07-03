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
      <div className="panel-title mb-2">Ask Voiant</div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(q)}
          placeholder="Ask a sales-planning question…"
          className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button className="btn-primary" onClick={() => submit(q)} disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>

      <div className="mt-3 eyebrow">{run ? "Suggested follow-ups" : "Try asking"}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(run?.suggested_followups ?? SUGGESTIONS).slice(0, 4).map((s) => (
          <button
            key={s}
            onClick={() => {
              setQ(s);
              submit(s);
            }}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slatebody hover:border-brand hover:text-brand-dark"
          >
            {s}
          </button>
        ))}
      </div>

      {run && (
        <div className="mt-3 text-[11px] text-slatebody">
          Routed to <b className="text-ink">{run.agent}</b> ({run.routed_from}) · run {run.run_id}
        </div>
      )}
    </div>
  );
}
