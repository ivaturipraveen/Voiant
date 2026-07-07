import type { Health } from "../api";

// Slim white strip under the header — the workspace context. Every value is real (client name
// and rep count from health); no timestamps/plan clutter, no hardcoded values.
export default function ContextBar({ health }: { health: Health | null }) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2.5 text-[12.5px]">
        <Item label="Client" value={health?.client?.name ?? "—"} />
        <Item label="Reps in scope" value={String(health?.dataset?.rep_count ?? "—")} />
        {health?.dataset?.mock_data && (
          <span className="ml-auto rounded-full bg-flag-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-flag-text">
            Demo data
          </span>
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-slatebody">
      {label}: <span className="font-semibold text-navy">{value}</span>
    </span>
  );
}
