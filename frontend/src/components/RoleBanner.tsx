// Explains what the currently-selected role can see/do — makes RBAC visible even on
// dashboards where rep names aren't front-and-center.

const ROLE_INFO: Record<string, { label: string; dot: string; text: string }> = {
  admin: {
    label: "Admin",
    dot: "bg-emerald-500",
    text: "Full access — real rep names & emails are visible, and you can upload data and reload config.",
  },
  analyst: {
    label: "Analyst",
    dot: "bg-amber-500",
    text: "PII partially masked — names show as initials (e.g. L. R.), emails as domain-only (j***@…). Switch to Admin to reveal full names.",
  },
  viewer: {
    label: "Viewer",
    dot: "bg-slate-400",
    text: "Read-only — names and emails are fully redacted (•••••). Upload and config changes are disabled.",
  },
};

export default function RoleBanner({ role }: { role: string }) {
  const info = ROLE_INFO[role] ?? ROLE_INFO.analyst;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slatebody">
      <span className="flex shrink-0 items-center gap-1.5 font-display text-[10px] font-semibold uppercase tracking-wider text-navy">
        <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
        Viewing as {info.label}
      </span>
      <span className="text-slate-400">·</span>
      <span>{info.text}</span>
    </div>
  );
}
