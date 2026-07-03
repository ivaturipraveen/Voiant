import type { Health } from "../api";
import VoiantLogo from "./VoiantLogo";

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
  const dot = on ? "bg-emerald-400" : degraded ? "bg-amber-400" : "bg-slate-400";
  const text = on ? "text-emerald-300" : degraded ? "text-amber-300" : "text-slate-300";
  const label = busy ? "Switching…" : on ? "Shield ON" : "Shield OFF";
  return (
    <button
      onClick={() => onToggle(!on)}
      disabled={busy}
      title="Turn Shield PII masking on or off (re-ingests the dataset)"
      className={`chip bg-white/10 ${text} transition hover:bg-white/15 disabled:opacity-70`}
    >
      <span className={`h-2 w-2 rounded-full ${dot} ${on && !busy ? "animate-pulse" : ""}`} />
      <span className="font-display font-semibold uppercase tracking-wider text-[10px]">{label}</span>
      <span
        className={`ml-0.5 flex h-3.5 w-6 items-center rounded-full px-0.5 transition ${
          on ? "bg-emerald-400/70" : "bg-white/20"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-2.5" : ""}`}
        />
      </span>
    </button>
  );
}

export default function VoiantHeader({
  health,
  role,
  onRole,
  onHelp,
  onToggleShield,
  shieldBusy,
}: {
  health: Health | null;
  role: string;
  onRole: (r: string) => void;
  onHelp: () => void;
  onToggleShield: (enabled: boolean) => void;
  shieldBusy: boolean;
}) {
  return (
    <header className="bg-gradient-to-r from-navy-deep via-navy to-navy-light text-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-6 py-3.5">
        <VoiantLogo />
        <div className="hidden border-l border-white/15 pl-4 sm:block">
          <div className="font-display text-[13px] font-bold uppercase tracking-[0.1em] text-white/90">
            Sales Planning Intelligence
          </div>
          <div className="text-[11px] text-white/55">
            {health?.client?.name ?? "—"} · config v{health?.client?.config_version ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShieldToggle
            status={health?.shield.status ?? "disabled"}
            busy={shieldBusy}
            onToggle={onToggleShield}
          />
          {health?.dataset.mock_data && (
            <span className="chip bg-amber-400/15 font-display text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Mock Data
            </span>
          )}
          <span className="chip bg-white/10 text-[11px] text-white/75">
            {health?.llm.enabled ? `Claude · ${health.llm.default_model}` : "Claude · fallback"}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={onHelp}
            title="What do these terms mean? (glossary)"
            className="grid h-7 w-7 place-items-center rounded-full border border-white/25 text-sm font-bold text-white/80 transition hover:border-brand hover:text-brand-light"
          >
            ?
          </button>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/60">
            Role
            <select
              value={role}
              onChange={(e) => onRole(e.target.value)}
              className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white outline-none focus:border-brand"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="text-ink">
                  {r}
                </option>
              ))}
            </select>
          </label>
          <div className="hidden items-center gap-2.5 md:flex">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/45">Powered by</div>
              <div className="font-display text-sm font-bold tracking-wide text-brand-light">Brightcone</div>
            </div>
            <img
              src="/brightcone-logo.webp"
              alt="Brightcone"
              className="h-9 w-auto drop-shadow"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
