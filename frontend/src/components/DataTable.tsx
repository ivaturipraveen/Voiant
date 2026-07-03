import { type ReactNode, useState } from "react";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: Record<string, unknown>) => ReactNode;
  className?: string;
}

// Consistent, lightly-striped table with optional "show more" collapsing.
export default function DataTable({
  columns,
  rows,
  initial,
  getKey,
  empty,
}: {
  columns: Column[];
  rows: Record<string, unknown>[];
  initial?: number;
  getKey?: (row: Record<string, unknown>, i: number) => string;
  empty?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = initial && !expanded ? rows.slice(0, initial) : rows;

  if (rows.length === 0) {
    return <p className="text-sm text-slatebody">{empty ?? "Nothing to show."}</p>;
  }

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slatebody">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`pb-2 text-[10px] font-semibold uppercase tracking-wider ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr
              key={getKey ? getKey(r, i) : i}
              className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`py-1.5 ${c.align === "right" ? "text-right" : ""} ${c.className ?? "text-ink"}`}
                >
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {initial && rows.length > initial && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 w-full rounded-lg border border-dashed border-slate-200 py-1.5 text-xs text-slatebody transition-colors hover:border-brand hover:text-brand-dark"
        >
          {expanded ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}
