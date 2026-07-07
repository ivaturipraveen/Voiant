import type { Health } from "../api";

const ROLES = ["analyst", "admin", "viewer"];

// Full-width dark header (spans above the sidebar). Left: Voiant logo + product name.
// Right: the Shield toggle (Secure Ingestion pill), role selector, and a role-derived user chip.
export default function AppHeader({
  health,
  role,
  onRole,
  onToggleShield,
  shieldBusy,
  onMenu,
  onLogout,
}: {
  health: Health | null;
  role: string;
  onRole: (r: string) => void;
  onToggleShield: (enabled: boolean) => void;
  shieldBusy: boolean;
  onMenu?: () => void; // open the mobile nav drawer (< lg)
  onLogout?: () => void;
}) {
  const shieldOn = (health?.shield.status ?? "disabled") === "active";
  const roleName = role.charAt(0).toUpperCase() + role.slice(1);
  const roleInitial = role.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 bg-navy-deep text-white">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            aria-label="Open navigation"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/10 lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <img src="/image.png" alt="Voiant" className="h-8 w-auto" />
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            Voiant
          </span>
          <span className="hidden h-5 w-px bg-white/15 sm:block" />
          <span className="hidden text-[13px] font-medium text-white/55 sm:block">
            Sales Planning Intelligence
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Shield · Secure Ingestion pill (clickable toggle) */}
          <button
            onClick={() => onToggleShield(!shieldOn)}
            disabled={shieldBusy}
            title="Shield PII masking — click to toggle (re-ingests the dataset)"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90 transition hover:bg-white/15 disabled:opacity-60"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                shieldBusy ? "bg-amber-300" : shieldOn ? "animate-pulse bg-brand-light" : "bg-slate-400"
              }`}
            />
            {shieldBusy ? "Switching…" : shieldOn ? "Shield · Secure Ingestion" : "Shield off"}
          </button>

          {/* Role selector */}
          <label className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1 pl-3 pr-1 text-[11px] uppercase tracking-wider text-white/50 sm:flex">
            Role
            <select
              value={role}
              onChange={(e) => onRole(e.target.value)}
              className="rounded-full bg-transparent px-1 py-0.5 text-xs font-semibold text-white outline-none [&>option]:text-navy"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {/* User chip — derived from the active role (no hardcoded name) */}
          <div className="flex items-center gap-2 pl-1">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand font-display text-xs font-bold text-white">
              {roleInitial}
            </span>
            <span className="hidden text-[13px] font-medium text-white/90 md:block">{roleName}</span>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
