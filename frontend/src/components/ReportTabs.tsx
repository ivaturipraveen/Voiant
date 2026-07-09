import type { Mode } from "./Sidebar";

type Tab = { id: Mode; label: string };

const TABS: Tab[] = [
  { id: "executive", label: "Executive Summary" },
  { id: "territory", label: "Territory & Quota" },
  { id: "capacity", label: "Capacity Analysis" },
  { id: "recommendations", label: "Recommendations" },
  { id: "ask", label: "Analytical Q&A" },
];

// The report's section navigation: numbered document tabs on the left, document actions
// on the right. "Data Sources" and "Audit" keep the governance surfaces reachable.
export default function ReportTabs({
  mode,
  onMode,
  onExport,
  execBadge,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  onExport: () => void;
  execBadge?: number;
}) {
  return (
    <nav className="sticky top-[61px] z-20 -mx-5 mt-1 border-b border-slate-200 bg-[#f9fafb]/90 px-5 backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-col gap-y-1 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t, i) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onMode(t.id)}
                className={`group relative flex items-center gap-2 whitespace-nowrap py-3 text-[13px] font-semibold transition-colors ${
                  active ? "text-navy" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <span className={`font-mono text-[11px] ${active ? "text-brand-dark" : "text-slate-300"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t.label}
                {t.id === "executive" && execBadge != null && execBadge > 0 && (
                  <span className="rounded-full bg-flag-text/15 px-1.5 text-[10px] font-bold text-flag-text">
                    {execBadge}
                  </span>
                )}
                <span
                  className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-opacity ${
                    active ? "bg-navy opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 pb-2 lg:py-2">
          <button onClick={onExport} className="btn-ghost py-1.5 text-[12.5px]">
            Export PDF
          </button>
          <button
            onClick={() => onMode("platform")}
            className={`btn-ghost py-1.5 text-[12.5px] ${
              mode === "platform" ? "border-slate-300 text-brand-dark" : ""
            }`}
          >
            Data Sources
          </button>
          <button
            onClick={() => onMode("audit")}
            className={`btn-ghost py-1.5 text-[12.5px] ${
              mode === "audit" ? "border-slate-300 text-brand-dark" : ""
            }`}
          >
            Audit
          </button>
        </div>
      </div>
    </nav>
  );
}
