import type { ReactNode } from "react";

// Minimal, safe markdown renderer for agent narratives. Handles headings (#/##/###),
// bold (**), italic (*), inline code (`), and bullet/numbered lists. React escapes all
// text, so there's no HTML-injection surface — we only emit our own elements.

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={key++} className="font-semibold text-navy">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={key++} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-navy">{t.slice(1, -1)}</code>);
    else out.push(<em key={key++}>{t.slice(1, -1)}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const lines = (source ?? "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (para.length) {
      blocks.push(
        <p key={key++} className="text-sm leading-relaxed text-ink">
          {renderInline(para.join(" "))}
        </p>
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key++} className={`${list.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5 text-sm text-ink`}>
          {list.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{renderInline(it)}</li>
          ))}
        </Tag>
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length;
      const cls =
        level === 1
          ? "font-display text-base font-extrabold uppercase tracking-wide text-navy mt-3"
          : level === 2
          ? "font-display text-sm font-bold text-navy mt-3"
          : "font-display text-[13px] font-bold text-navy mt-2";
      blocks.push(<div key={key++} className={cls}>{renderInline(h[2])}</div>);
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push((ul ? ul[1] : ol![1]));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();

  return <div className={`space-y-2 ${className}`}>{blocks}</div>;
}
