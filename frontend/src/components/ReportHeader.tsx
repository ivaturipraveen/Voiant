import type { Health } from "../api";

const ROLES = ["analyst", "admin", "viewer"];

// Voiant wordmark — same mark as the platform header (/image.png) + capitalized wordmark.
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/image.png" alt="" className="h-8 w-auto" aria-hidden />
      <span className="font-display text-[20px] font-extrabold tracking-tight text-navy">Voiant</span>
    </div>
  );
}

// Light "document" header for the report surface. Left: brand. Right: Shield toggle,
// prepared-for client chip, role selector, and utility actions.
export default function ReportHeader({
  health,
  role,
  onRole,
  onToggleShield,
  shieldBusy,
  onOpenConfig,
  onLogout,
  preview,
}: {
  health: Health | null;
  role: string;
  onRole: (r: string) => void;
  onToggleShield: (enabled: boolean) => void;
  shieldBusy: boolean;
  onOpenConfig?: () => void;
  onLogout?: () => void;
  preview: string;
}) {
  const shieldOn = (health?.shield.status ?? "disabled") === "active";
  const roleName = role.charAt(0).toUpperCase() + role.slice(1);
  const rawName = health?.client.name ?? "Client";
  const isRapid7 = /rapid7/i.test(rawName);
  const preparedFor = isRapid7 ? "Rapid7" : rawName.replace(/\s*\(sample\)\s*/i, "").trim() || rawName;
  const preparedInitial = preparedFor.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[1440px] px-5 py-3 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
            <Wordmark />
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <span className="hidden text-[13px] font-medium text-slate-500 sm:block">
              Sales Planning Intelligence
            </span>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end sm:gap-3 md:gap-4">
            {/* Shield, date, prepared-for — visible on all breakpoints */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={() => onToggleShield(!shieldOn)}
                disabled={shieldBusy}
                title="Shield PII masking — click to toggle (re-ingests the dataset)"
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[12px]"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    shieldBusy ? "bg-amber-400" : shieldOn ? "animate-pulse bg-brand" : "bg-slate-300"
                  }`}
                />
                <span className="whitespace-nowrap">
                  {shieldBusy
                    ? "Switching…"
                    : shieldOn
                      ? (
                          <>
                            <span className="sm:hidden">Secure</span>
                            <span className="hidden sm:inline">Shield · Secure</span>
                          </>
                        )
                      : "Shield off"}
                </span>
              </button>

              <div className="shrink-0 text-[10px] leading-tight text-slate-400 sm:text-[10.5px]">{preview}</div>

              <span className="hidden h-8 w-px bg-slate-200 md:block" />

              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
                <div className="min-w-0 text-right leading-tight">
                  <div className="hidden text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:block">
                    Prepared for
                  </div>
                  <div className="truncate text-[12px] font-semibold text-navy sm:text-[13px]">{preparedFor}</div>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand font-display text-[11px] font-bold text-white ring-2 ring-brand/20 sm:h-9 sm:w-9 sm:text-xs">
                  {preparedInitial}
                </span>
              </div>
            </div>

            {/* Role + utility actions */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden h-8 w-px bg-slate-200 sm:block" />

              <label
                className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-[11px] uppercase tracking-wider text-slate-400 sm:flex"
                title="Switch role (changes field-level masking)"
              >
                Role
                <div className="relative">
                  <span className="flex items-center gap-1 rounded-full px-1 py-0.5 text-xs font-semibold text-navy">
                    {roleName}
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                  <select
                    value={role}
                    onChange={(e) => onRole(e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Role"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              <label className="flex items-center sm:hidden" title="Switch role">
                <select
                  value={role}
                  onChange={(e) => onRole(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold capitalize text-navy"
                  aria-label="Role"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              {onOpenConfig && (
                <button
                  onClick={onOpenConfig}
                  title="Configuration"
                  aria-label="Configuration"
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              )}

              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Log out"
                  aria-label="Log out"
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-navy"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
