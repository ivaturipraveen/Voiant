// In-app glossary — a "?" button opens this so anyone can look up a term during a demo.

type Term = { term: string; def: string };

const GROUPS: { title: string; terms: Term[] }[] = [
  {
    title: "The basics",
    terms: [
      { term: "Rep", def: "A salesperson (sales representative)." },
      { term: "Quota", def: "A rep's yearly sales target — how much they're expected to sell." },
      { term: "Deployed quota", def: "All rep quotas added together." },
      { term: "Top-down target", def: "The company's overall goal. Different from deployed quota." },
      { term: "Over-assignment", def: "Handing out more quota than the top-down target." },
      { term: "Pipeline / opportunity", def: "The value of the open deals a rep is working on." },
      { term: "Segment", def: "A customer group (e.g. Enterprise, Mid-Market, SMB) — the actual segments come from your data." },
      { term: "OTE / OTC", def: "On-Target Earnings / Commission — what a rep is paid if they hit quota." },
      { term: "Attainment", def: "How much of their quota a rep has actually achieved." },
    ],
  },
  {
    title: "Fairness (Quota Equity agent)",
    terms: [
      { term: "Fairness ratio", def: "Quota ÷ opportunity. Higher = a big target vs little available business = stretched." },
      { term: "Deviation", def: "How far a rep is from their team's normal, as a %. +30% = 30% more loaded than peers." },
      { term: "Paintbrushed", def: "Everyone got nearly the same quota regardless of their territory — unfair ('painted with one brush')." },
      { term: "Bands", def: "Underloaded · Equitable · Stretched · Overloaded — how fair each rep's quota is." },
    ],
  },
  {
    title: "Capacity (Capacity Headroom agent)",
    terms: [
      { term: "Headroom / capacity", def: "How much MORE quota the team can take before people are overworked — spare room." },
      { term: "Overloaded / Balanced / Underloaded", def: "How busy a rep is vs the norm. Overloaded = too much; underloaded = has room." },
      { term: "Redistribution", def: "Moving quota from overloaded reps to reps who have room." },
      { term: "What-if", def: "Testing a hypothetical on the real data — e.g. 'cut 3 reps' or 'add 5 heads'." },
    ],
  },
  {
    title: "How it works (technical)",
    terms: [
      { term: "Agent", def: "A specialist AI that does one job (e.g. Quota Equity checks fairness)." },
      { term: "Scenario Orchestrator", def: "The 'manager' AI that picks the right agent(s) and combines their answers." },
      { term: "Shield", def: "The security layer that hides personal info (names, emails) behind codes." },
      { term: "Masking / token", def: "Replacing a real value with a code, e.g. 'Liam Rossi' → [PERSON 1]." },
      { term: "RBAC / Role", def: "Who's allowed to see what: Admin (full), Analyst (partial), Viewer (hidden)." },
      { term: "Audit & Lineage", def: "The record of which data was read and what the AI did, for every question." },
      { term: "Determinism / hash", def: "The same question always gives the same numbers — with a fingerprint to prove it." },
      { term: "Mock / synthetic data", def: "Made-up but realistic data. No real company data is used." },
    ],
  },
];

export default function HelpGlossary({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 text-navy">
          <div>
            <div className="font-display text-sm font-bold uppercase tracking-wide">Glossary</div>
            <div className="text-[11px] text-slatebody">Plain-English meaning of every term</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-slatebody hover:bg-slate-100">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="space-y-5 p-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="eyebrow mb-2">{g.title}</div>
              <dl className="space-y-2.5">
                {g.terms.map((t) => (
                  <div key={t.term} className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                    <dt className="text-sm font-semibold text-navy">{t.term}</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-slatebody">{t.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
