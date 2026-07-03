import type { Health } from "../api";

const ROLES = ["analyst", "admin", "viewer"];

function ShieldToggle({
  status,
  busy,
  onToggle,
}: {
  status: string;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const on = status === "active";
  const degraded = status === "degraded";
  const dot = on ? "bg-emerald-500" : degraded ? "bg-amber-500" : "bg-slate-400";
  const label = busy ? "Switching…" : on ? "Shield on" : "Shield off";
  return (
    <button
      onClick={() => onToggle(!on)}
      disabled={busy}
      title="Turn Shield PII masking on or off (re-ingests the dataset)"
      className="chip border border-slate-200 bg-white text-slatebody transition hover:border-slate-300 disabled:opacity-70"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${on && !busy ? "animate-pulse" : ""}`} />
      <span className="text-[11px] font-medium text-navy">{label}</span>
      <span
        className={`ml-0.5 flex h-3.5 w-6 items-center rounded-full px-0.5 transition ${
          on ? "bg-emerald-500/80" : "bg-slate-300"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-2.5" : ""}`}
        />
      </span>
    </button>
  );
}

export default function Topbar({
  eyebrow,
  title,
  sub,
  health,
  role,
  onRole,
  onHelp,
  onToggleShield,
  shieldBusy,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  health: Health | null;
  role: string;
  onRole: (r: string) => void;
  onHelp: () => void;
  onToggleShield: (enabled: boolean) => void;
  shieldBusy: boolean;
}) {
  const roleInitial = role.slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-4 px-6 py-3.5">
        <div className="min-w-0">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="font-display text-xl font-bold tracking-tight text-navy">{title}</h1>
          <p className="truncate text-[12px] text-slatebody">{sub}</p>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <ShieldToggle
            status={health?.shield.status ?? "disabled"}
            busy={shieldBusy}
            onToggle={onToggleShield}
          />
          {health?.dataset.mock_data && (
            <span className="chip border border-amber-200 bg-amber-50 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Mock data
            </span>
          )}
          <span className="chip hidden border border-slate-200 bg-white text-[11px] text-slatebody sm:inline-flex">
            {health?.llm.enabled ? `Claude · ${health.llm.default_model}` : "Claude · fallback"}
          </span>

          <button
            onClick={onHelp}
            title="What do these terms mean? (glossary)"
            className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-sm font-bold text-slatebody transition hover:border-brand hover:text-brand-dark"
          >
            ?
          </button>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1 text-[11px] uppercase tracking-wider text-slate-400">
            Role
            <select
              value={role}
              onChange={(e) => onRole(e.target.value)}
              className="rounded-md bg-transparent px-1 py-1 text-xs font-semibold text-navy outline-none"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-display text-xs font-bold text-white">
            {roleInitial}
          </span>
        </div>
      </div>
    </header>
  );
}
