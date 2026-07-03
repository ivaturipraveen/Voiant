import { useEffect, useState } from "react";

// Detailed view of the real pipeline while an agent runs. Steps 1–4 are near-instant;
// step 5 (Claude) is the bottleneck, so we advance quickly then dwell on the last one.
type Step = { label: string; detail: string; points: string[] };

function steps(question: string): Step[] {
  const q = question ? `“${question}”` : "your question";
  return [
    {
      label: "Routing your question",
      detail: `The Scenario Orchestrator reads the intent of ${q} and picks the specialist agent.`,
      points: [
        "Clear keyword → straight to the agent; otherwise Claude classifies the intent",
        "Detects what-if scenarios (cut / add reps) and big-picture (runs both agents)",
        "Keeps conversation context so follow-ups stay on topic",
      ],
    },
    {
      label: "Secure read through Shield",
      detail: "Reading the 80 reps from the database behind the Shield PII boundary.",
      points: [
        "Names & emails are stored as tokens ([PERSON 1]) and re-hydrated for your role",
        "Admin sees full · Analyst initials · Viewer redacted — masking applied here",
        "Every field read is logged to the lineage / audit trail (≈160 reads per run)",
      ],
    },
    {
      label: "Deterministic engine — the math",
      detail: "Pure Python computes every number and finding. No AI here — fully repeatable.",
      points: [
        "Fairness ratio = quota ÷ opportunity, banded (Equitable → Overloaded)",
        "Paintbrush detection via coefficient of variation; deployed-vs-target gap",
        "Capacity headroom, redistribution moves, and what-if recomputation",
      ],
    },
    {
      label: "Audit seal",
      detail: "Sealing the result so the exact answer is reproducible and provable.",
      points: [
        "SHA-256 determinism hash over the computed numbers",
        "Records the agent, config version, and field-read count to the audit log",
        "Same question → same hash → same numbers, every time",
      ],
    },
    {
      label: "Claude writes the answer",
      detail: `The model explains the computed numbers, answering ${q} specifically.`,
      points: [
        "Model routing: Sonnet by default, Opus for complex questions & scenarios",
        "The computed figures are injected as JSON — Claude only phrases them",
        "It never invents, rounds, or alters a number",
      ],
    },
  ];
}
const AT = [0, 500, 1050, 1600, 2200]; // ms thresholds; step 5 then dwells

export default function ThinkingIndicator({ question = "" }: { question?: string }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setMs(performance.now() - start), 100);
    return () => clearInterval(id);
  }, []);

  const STEPS = steps(question);
  let step = 0;
  for (let i = 0; i < AT.length; i++) if (ms >= AT[i]) step = i;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
          <span className="panel-title">Processing — what's happening inside</span>
        </div>
        <span className="font-mono text-xs text-slatebody">{(ms / 1000).toFixed(1)}s</span>
      </div>

      <ol className="space-y-4">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold transition ${
                  state === "done"
                    ? "bg-brand text-white"
                    : state === "active"
                    ? "border-2 border-brand text-brand"
                    : "border border-slate-300 text-slate-300"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm ${
                    state === "todo"
                      ? "text-slate-400"
                      : state === "active"
                      ? "font-semibold text-navy"
                      : "font-medium text-slatebody"
                  }`}
                >
                  {s.label}
                  {state === "active" && <span className="ml-1 animate-pulse text-brand">…</span>}
                </div>
                <div className={`text-[11px] leading-snug ${state === "todo" ? "text-slate-300" : "text-slatebody"}`}>
                  {s.detail}
                </div>
                {state !== "todo" && (
                  <ul className="mt-1 space-y-0.5">
                    {s.points.map((p, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
