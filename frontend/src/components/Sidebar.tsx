export type Mode = "ask" | "territory" | "capacity" | "executive" | "platform" | "config" | "audit";

type Item = { id: Mode; label: string; icon: JSX.Element };

const I = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  wave: <path d="M3 12c3 0 3-6 6-6s3 12 6 12 3-6 6-6" />,
  doc: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </>
  ),
  chat: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  db: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  check: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
  sliders: (
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
};

const DASHBOARDS: Item[] = [
  { id: "territory", label: "Territory Equity", icon: I.grid },
  { id: "capacity", label: "Capacity Overview", icon: I.wave },
  { id: "executive", label: "Executive Summary", icon: I.doc },
];
const AGENTS: Item[] = [{ id: "ask", label: "Ask the platform", icon: I.chat }];
const DATA: Item[] = [
  { id: "platform", label: "Sources & lineage", icon: I.db },
  { id: "audit", label: "Audit log", icon: I.check },
];
const SETTINGS: Item[] = [{ id: "config", label: "Configuration", icon: I.sliders }];

export default function Sidebar({
  mode,
  onMode,
  badges,
  open = false,
  onClose,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  badges?: Partial<Record<Mode, number>>;
  open?: boolean; // mobile drawer open (< lg)
  onClose?: () => void;
}) {
  const select = (m: Mode) => {
    onMode(m);
    onClose?.(); // close the drawer after choosing on mobile
  };

  const NavItem = ({ item }: { item: Item }) => (
    <button onClick={() => select(item.id)} className={`nav-item w-full ${mode === item.id ? "nav-item-active" : ""}`}>
      <svg
        viewBox="0 0 24 24"
        className="h-[17px] w-[17px] shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {item.icon}
      </svg>
      <span className="flex-1 text-left">{item.label}</span>
      {badges?.[item.id] != null && (
        <span className="rounded-full bg-flag-text/15 px-1.5 text-[10px] font-bold text-flag-text">
          {badges[item.id]}
        </span>
      )}
    </button>
  );

  const Group = ({ title, items }: { title: string; items: Item[] }) => (
    <div className="px-3">
      <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((it, i) => (
          <NavItem key={`${it.id}-${i}`} item={it} />
        ))}
      </div>
    </div>
  );

  const content = (
    <>
      <nav className="py-2">
        <Group title="Dashboards" items={DASHBOARDS} />
        <Group title="Agents" items={AGENTS} />
        <Group title="Data" items={DATA} />
        <Group title="Settings" items={SETTINGS} />
      </nav>

      <div className="mt-auto border-t border-slate-200 px-5 py-4">
        <div className="text-[9px] uppercase tracking-[0.14em] text-slate-400">Powered by</div>
        <img src="/brightcone-wordmark.webp" alt="brightcone.ai" className="mt-1.5 h-6 w-auto" />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: fixed left rail (lg+) */}
      <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-[240px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex">
        {content}
      </aside>

      {/* Mobile: slide-over drawer (< lg) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-deep/40 backdrop-blur-[1px]" onClick={onClose} />
          <aside className="absolute left-0 top-0 flex h-full w-[264px] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
