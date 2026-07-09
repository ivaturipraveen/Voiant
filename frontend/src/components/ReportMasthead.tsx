import type { Health } from "../api";

function MetaField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-[13.5px] font-semibold text-navy">
        {value}
        {sub && <span className="ml-1.5 font-normal text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

// The "document" masthead: analysis eyebrow, report title, standfirst, and a governance
// meta strip. Values are pulled from the live /health + /config responses.
export default function ReportMasthead({
  health,
  rulesetsCount,
  segmentCount,
}: {
  health: Health | null;
  rulesetsCount?: number;
  segmentCount?: number;
}) {
  const now = new Date();
  const fy = `FY${String(now.getFullYear()).slice(2)}`;
  const analysisDate = now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  const asOf = now.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const asOfDate = now.toLocaleDateString("en-US", { day: "numeric", month: "short" });

  // Display-only cleanup of the client name (backend value is untouched): drop the
  // "(sample)" tag and present Rapid7 in its formal "Rapid7, Inc." form to match the report.
  const rawName = health?.client.name ?? "Client";
  const isRapid7 = /rapid7/i.test(rawName);
  const clientName = isRapid7 ? "Rapid7, Inc." : rawName.replace(/\s*\(sample\)\s*/i, "").trim() || rawName;
  const clientShort = isRapid7 ? "Rapid7" : clientName;
  const ticker = isRapid7 ? "NASDAQ: RPD" : undefined;
  const repCount = health?.dataset.rep_count ?? 0;
  const rulesets = rulesetsCount ?? health?.client.config_version ?? 0;

  return (
    <section className="pt-6">
      <div className="max-w-3xl">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand-dark">
            {fy} Sales Plan Analysis · Q2 Review
          </div>
          <h1 className="mt-1.5 font-display text-[22px] font-semibold leading-tight tracking-tight text-navy sm:text-[25px]">
            {clientName} — Territory, Capacity &amp; Pipeline Health
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">
            Analytical review of quota deployment, rep-level capacity, and mid-year pipeline health across the{" "}
            {repCount}-rep sales organization. Synthesized from Salesforce, Anaplan, and Workday sources under the{" "}
            {clientShort} {fy} planning ruleset.
          </p>
        </div>

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-slate-200 py-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetaField label="Client" value={clientName} sub={ticker} />
        <MetaField label="Plan Period" value={fy} sub={`Jan–Dec ${now.getFullYear()}`} />
        <MetaField label="Analysis Date" value={analysisDate} />
        <MetaField label="Data As-Of" value={asOf} sub={`· ${asOfDate}`} />
        <MetaField
          label="Reps In Scope"
          value={String(repCount)}
          sub={segmentCount ? `across ${segmentCount} segments` : undefined}
        />
        <MetaField label="Rulesets Applied" value={String(rulesets)} sub={`${clientShort} ${fy}`} />
      </div>
    </section>
  );
}
