// Explains what the currently-selected role can see/do — makes RBAC visible even on
// dashboards where rep names aren't front-and-center.

const ROLE_INFO: Record<string, { label: string; tone: string; text: string }> = {
  admin: {
    label: "Admin",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    text: "Full access — real rep names & emails are visible, and you can upload data and reload config.",
  },
  analyst: {
    label: "Analyst",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    text: "PII partially masked — names show as initials (e.g. L. R.), emails as domain-only (j***@…). Switch to Admin to reveal full names.",
  },
  viewer: {
    label: "Viewer",
    tone: "border-slate-200 bg-slate-50 text-slatebody",
    text: "Read-only — names and emails are fully redacted (•••••). Upload and config changes are disabled.",
  },
};

export default function RoleBanner({ role }: { role: string }) {
  const info = ROLE_INFO[role] ?? ROLE_INFO.analyst;
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${info.tone}`}>
      <span className="mt-px font-display text-[10px] font-bold uppercase tracking-wider">
        Viewing as {info.label}
      </span>
      <span className="opacity-80">— {info.text}</span>
    </div>
  );
}
