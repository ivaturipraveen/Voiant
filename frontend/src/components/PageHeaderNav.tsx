import type { Mode } from "./Sidebar";
import { ExportButton } from "./Shared";

const TABS = [
  { id: "executive", num: "01", label: "Executive Summary" },
  { id: "territory", num: "02", label: "Territory & Quota" },
  { id: "capacity", num: "03", label: "Capacity Analysis" },
  { id: "recommendations", num: "04", label: "Recommendations" },
  { id: "ask", num: "05", label: "Analytical Q&A" },
  { id: "audit", num: "06", label: "Audit Log" },
  { id: "config", num: "07", label: "Configuration" },
] as const;

export default function PageHeaderNav({
  mode,
  onMode,
  exportData,
  metadata,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  exportData: unknown;
  metadata?: Record<string, string>;
}) {
  return (
    <>
      <div className="mb-6 pt-6">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
          FY26 SALES PLAN ANALYSIS · Q2 REVIEW
        </div>
        <h1 className="mb-3 font-display text-2xl font-medium text-navy">
          {metadata?.company_name || "Rapid7, Inc."} — Territory, Capacity & Pipeline Health
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slatebody">
          Analytical review of quota deployment, rep-level capacity, and mid-year pipeline health across the {metadata?.reps_in_scope?.split(' ')[0] || "52"}-rep sales
          organization. Synthesized from Salesforce, Anaplan, and Workday sources under {metadata?.client_name || "Rapid7"} FY26 planning ruleset.
        </p>

        <div className="mt-6 flex flex-nowrap items-center justify-between gap-x-8 overflow-x-auto border-y border-slate-200 py-4 no-scrollbar">
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.client_name ? `${metadata.client_name} (NASDAQ: RPD)` : "Rapid7, Inc. (NASDAQ: RPD)"}</div>
          </div>
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plan Period</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.plan_period || "FY26 Jan–Dec 2026"}</div>
          </div>
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Analysis Date</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.analysis_date || "24 June 2026"}</div>
          </div>
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data As-Of</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.data_as_of || "09:14 EDT · 24 Jun"}</div>
          </div>
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reps In Scope</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.reps_in_scope || "52 across 4 segments"}</div>
          </div>
          <div className="whitespace-nowrap">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rulesets Applied</div>
            <div className="mt-1 text-xs font-semibold text-navy">{metadata?.rulesets_applied || "3 Rapid7 FY26"}</div>
          </div>
        </div>
      </div>

      <div className="sticky top-[63px] z-40 mb-6 flex flex-nowrap items-end justify-between overflow-x-auto border-b border-slate-200 bg-[#f7f8fa] no-scrollbar">
        <nav className="flex flex-nowrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onMode(t.id as Mode)}
              className={`whitespace-nowrap px-4 py-3 text-[13.5px] transition-colors border-b-[3px] ${
                mode === t.id
                  ? "border-[#4a77b4] bg-[#f0f5fa] text-[#4a77b4] font-medium"
                  : "border-transparent text-slate-500 font-medium hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className={`mr-2 ${mode === t.id ? "text-[#4a77b4]" : "text-slate-400"}`}>{t.num}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex flex-nowrap items-center gap-2 pb-2 pl-4">
          <div className="relative whitespace-nowrap">
            {exportData ? (
              <div className="[&>button]:rounded-md [&>button]:border [&>button]:border-slate-200 [&>button]:bg-white [&>button]:px-3 [&>button]:py-1.5 [&>button]:text-[13px] [&>button]:font-medium [&>button]:text-slate-700 [&>button]:shadow-sm hover:[&>button]:border-[#4a77b4] hover:[&>button]:bg-[#f0f5fa] hover:[&>button]:text-[#4a77b4] [&>button]:transition-colors [&>button>svg]:hidden">
                <ExportButton data={exportData} filename={`voiant-export-${mode}`} label="Export PDF" />
              </div>
            ) : (
              <button className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm opacity-50 cursor-not-allowed" disabled>
                Export PDF
              </button>
            )}
          </div>
          <button
            onClick={() => onMode("platform")}
            className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:border-[#4a77b4] hover:bg-[#f0f5fa] hover:text-[#4a77b4]"
          >
            Data Sources
          </button>
        </div>
      </div>
    </>
  );
}
