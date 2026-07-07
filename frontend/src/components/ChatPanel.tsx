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
  docked = false,
}: {
  onAsk: (q: string) => void;
  loading: boolean;
  run: AgentRunResponse | null;
  docked?: boolean; // bottom-of-thread composer: starts empty, no run footer
}) {
  const [q, setQ] = useState(docked ? "" : SUGGESTIONS[0]);

  const submit = (text: string) => {
    if (!text.trim() || loading) return;
    onAsk(text.trim());
    setQ(""); // clear so the next follow-up starts fresh
  };

  const chips = (run?.suggested_followups ?? SUGGESTIONS).slice(0, 4);

  return (
    <div className={docked ? "card p-3 shadow-lg ring-1 ring-black/5" : "card p-4"}>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 transition focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/15">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(q)}
          placeholder={docked ? "Ask a follow-up…" : "Ask a sales-planning question…"}
          className="flex-1 bg-transparent py-1.5 text-sm text-navy outline-none placeholder:text-slate-400"
        />
        <button className="btn-primary shrink-0 py-1.5" onClick={() => submit(q)} disabled={loading}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-slate-400">
          {run ? "Follow-ups" : "Try"}
        </span>
        {chips.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slatebody transition hover:border-brand hover:bg-brand/5 hover:text-brand-dark disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
