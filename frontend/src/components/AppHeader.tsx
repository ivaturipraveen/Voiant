import type { Health } from "../api";

const ROLES = ["analyst", "admin", "viewer"];

export default function AppHeader({
  health,
  role,
  onRole,
  onToggleShield,
  shieldBusy,
  onMenu,
  onLogout,
  currentUser = "Sarah Coleman",
}: {
  health: Health | null;
  role: string;
  onRole: (r: string) => void;
  onToggleShield: (enabled: boolean) => void;
  shieldBusy: boolean;
  onMenu?: () => void;
  onLogout?: () => void;
  currentUser?: string;
}) {
  const shieldOn = (health?.shield.status ?? "disabled") === "active";

  const formattedUser = (() => {
    const clean = currentUser.split('@')[0];
    const parts = clean.split(/[\._\-]/);
    if (parts.length >= 2) {
      const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const last = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return {
        fullName: `${first} ${last}`,
        initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
      };
    } else {
      const name = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
      let initials = name.slice(0, 2).toUpperCase();
      if (name.length > 1 && /[A-Z]/.test(name.slice(1))) {
        const upperIdx = name.slice(1).search(/[A-Z]/) + 1;
        initials = (name.charAt(0) + name.charAt(upperIdx)).toUpperCase();
      }
      return {
        fullName: name,
        initials: initials
      };
    }
  })();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="flex flex-col gap-3 px-6 md:px-8 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-0">
        
        {/* Left Side: Brand & Subtitle (Row 1 on mobile, Left on desktop) */}
        <div className="flex items-center justify-between lg:justify-start lg:gap-3">
          <div className="flex items-center gap-3">
            {/* Logo icon — exact PNG from public/image.png */}
            <img src="/image.png" alt="Voiant logo" className="h-8 w-8 object-contain" />

            {/* Brand name */}
            <span className="font-display text-[18px] font-bold tracking-tight text-navy">
              Voiant
            </span>
            <span className="mx-3 h-4 w-px bg-slate-200 hidden sm:inline" />
            <span className="text-[13px] font-medium text-slate-500 hidden sm:inline">
              Sales Planning Intelligence
            </span>
          </div>
          
          {/* Mobile-only avatar and logout (so they stay on Row 1) */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#4a77b4] text-[13px] font-bold text-white shadow-sm">
              {formattedUser.initials}
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Controls, Info & Desktop User Info */}
        <div className="flex flex-col gap-3 w-full lg:flex-row lg:w-auto lg:items-center lg:gap-0">
          
          {/* 2x2 Grid on Mobile, Flex Row on Desktop */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 w-full items-center lg:flex lg:w-auto lg:items-center lg:gap-0">
            
            {/* Col 1, Row 1: Shield Toggle */}
            <div className="flex items-center justify-start lg:mr-4">
              <button
                onClick={() => onToggleShield(!shieldOn)}
                disabled={shieldBusy}
                title="Shield PII masking — click to toggle"
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    shieldBusy ? "bg-amber-400" : shieldOn ? "animate-pulse bg-[#4a77b4]" : "bg-slate-300"
                  }`}
                />
                {shieldBusy ? "Switching…" : shieldOn ? "Shield Active" : "Shield off"}
              </button>
            </div>

            {/* Col 2, Row 1: Role selector */}
            <div className="flex items-center justify-start lg:mr-6">
              <label className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-[11px] uppercase tracking-wider text-slate-400 shadow-sm">
                Role
                <select
                  value={role}
                  onChange={(e) => onRole(e.target.value)}
                  className="rounded-full bg-slate-100/50 px-2 py-0.5 text-xs font-semibold text-navy outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Col 1, Row 2: Confidential Block */}
            <div className="flex flex-col items-start justify-center lg:items-end lg:mr-6">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-[#4a77b4]">
                <div className="h-1.5 w-1.5 rounded-full bg-[#4a77b4]"></div>
                CONFIDENTIAL
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Preview v0.4 · 24 Jun 2026</div>
            </div>

            {/* Col 2, Row 2: Prepared For */}
            <div className="flex flex-col items-start justify-center lg:mr-5">
              <div className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                Prepared For
              </div>
              <div className="text-[13px] font-semibold text-navy leading-tight mt-0.5">
                Rapid7
              </div>
            </div>

          </div>

          {/* Desktop-only divider & avatar/logout */}
          <div className="hidden h-9 w-px bg-slate-200 mr-5 lg:block"></div>
          <div className="hidden items-center lg:flex">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#4a77b4] text-[13px] font-bold text-white shadow-sm">
              {formattedUser.initials}
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out"
                aria-label="Log out"
                className="ml-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
