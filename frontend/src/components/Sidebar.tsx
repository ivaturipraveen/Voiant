import type { Health } from "../api";

type Mode = "ask" | "platform" | "config";

const NAV: { id: Mode; label: string; hint: string; icon: JSX.Element }[] = [
  {
    id: "ask",
    label: "Conversational",
    hint: "Ask in plain English",
    icon: (
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    ),
  },
  {
    id: "platform",
    label: "Behind the Scenes",
    hint: "Agents · pipeline · audit",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
  {
    id: "config",
    label: "Configuration",
    hint: "Interpretation rules",
    icon: (
      <>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </>
    ),
  },
];

export default function Sidebar({
  mode,
  onMode,
  health,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  health: Health | null;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/image.png" alt="Voiant" className="h-9 w-auto" />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-extrabold uppercase tracking-[0.04em] text-navy">
            Voiant<sup className="ml-0.5 align-super text-[0.5em] text-brand">®</sup>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Sales Planning
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 py-2">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onMode(n.id)}
            className={`nav-item ${mode === n.id ? "nav-item-active" : ""}`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px] shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {n.icon}
            </svg>
            <span className="flex flex-col items-start leading-tight">
              <span>{n.label}</span>
              <span
                className={`text-[10px] font-normal ${
                  mode === n.id ? "text-brand-dark/60" : "text-slate-400"
                }`}
              >
                {n.hint}
              </span>
            </span>
          </button>
        ))}
      </nav>

      {/* Client context */}
      <div className="mx-3 mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Workspace</div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-navy">
          {health?.client?.name ?? "—"}
        </div>
        <div className="mt-0.5 text-[11px] text-slatebody">
          config v{health?.client?.config_version ?? "—"} · {health?.dataset?.rep_count ?? "—"} reps
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 px-5 py-4">
        <div className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Powered by</div>
        <img
          src="/brightcone-wordmark.webp"
          alt="brightcone.ai — Clarity. Focus. Impact"
          className="mt-1.5 h-6 w-auto"
        />
      </div>
    </aside>
  );
}
