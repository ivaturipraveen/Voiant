import { useEffect, useState } from "react";
import { api, fmtMoney, type ClientConfig } from "../api";
import { Icon } from "./icons";

// A dedicated, presentable page for the client-specific configuration ("interpretation
// ledger"). Everything the agents apply lives here — and the key numeric levers are
// editable live: change a value, Apply, and the whole platform recomputes against it.
export default function ConfigPage({ role, onChanged }: { role: string; onChanged: () => void }) {
  const [saved, setSaved] = useState<ClientConfig | null>(null);
  const [draft, setDraft] = useState<ClientConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const editable = role !== "viewer";

  const load = () =>
    api.config().then((c) => {
      setSaved(c);
      setDraft(structuredClone(c));
    });
  useEffect(() => {
    load();
  }, []);

  if (!draft || !saved) {
    return <div className="card p-6 text-sm text-slatebody">Loading configuration…</div>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (fn: (d: ClientConfig) => void) => {
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
    setNote(null);
  };

  const apply = async () => {
    setBusy(true);
    setNote(null);
    try {
      const updated = await api.updateConfig({
        company: { name: draft.company.name, top_down_target: String(draft.company.top_down_target) },
        segment_definitions: draft.segment_definitions,
        fairness_bands: draft.fairness_bands,
        capacity: draft.capacity,
      });
      setSaved(updated);
      setDraft(structuredClone(updated));
      onChanged();
      setNote(`Applied live — now v${updated.version}. Every answer & dashboard now uses these values.`);
    } catch {
      setNote("Could not apply — the values failed validation. Nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-brand-dark">
              Interpretation ledger
            </div>
            <div className="font-display text-lg font-bold text-navy">
              {draft.client_name} — Configuration
            </div>
            <div className="text-xs text-slatebody">
              Client <span className="font-medium text-navy">{draft.client_id}</span> · config version v{saved.version}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editable ? (
              <button className="btn-primary" onClick={apply} disabled={!dirty || busy}>
                {busy ? "Applying…" : dirty ? "Apply changes" : "No changes"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs text-slatebody">
                <Icon name="lock" className="h-3.5 w-3.5" /> Read-only (viewer)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-2.5">
          <p className="text-xs text-slatebody">
            These are the client-specific rules the agents apply. Edit a lever and{" "}
            <b className="text-navy">Apply</b> — every answer and dashboard recomputes against it live.
            Changes update this client’s single config row in the database (one row per company).
          </p>
          {note && (
            <span className="ml-3 shrink-0 rounded-md bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand-dark">
              {note}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Company target */}
        <Section title="Company target" desc="The top-down number the company commits to — distinct from deployed quota (the sum of rep quotas).">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Label>Top-down target</Label>
              <NumberField
                value={Number(draft.company.top_down_target)}
                step={1_000_000}
                disabled={!editable}
                onChange={(v) => patch((d) => (d.company.top_down_target = String(v)))}
              />
            </div>
            <div className="pb-2 text-right">
              <div className="text-[11px] text-slatebody">Reads as</div>
              <div className="metric-value text-navy">{fmtMoney(draft.company.top_down_target)}</div>
            </div>
          </div>
        </Section>

        {/* Capacity thresholds */}
        <Section title="Capacity thresholds" desc="Classify a rep's load (quota ÷ segment baseline). Above ‘over’ = Overloaded; below ‘under’ = Underloaded; ‘max stretch’ sets the sustainable ceiling for headroom.">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Over threshold">
              <NumberField value={draft.capacity?.over_threshold ?? 1.15} step={0.05} disabled={!editable}
                onChange={(v) => patch((d) => d.capacity && (d.capacity.over_threshold = v))} />
            </Field>
            <Field label="Under threshold">
              <NumberField value={draft.capacity?.under_threshold ?? 0.85} step={0.05} disabled={!editable}
                onChange={(v) => patch((d) => d.capacity && (d.capacity.under_threshold = v))} />
            </Field>
            <Field label="Max stretch">
              <NumberField value={draft.capacity?.max_stretch ?? 1.15} step={0.05} disabled={!editable}
                onChange={(v) => patch((d) => d.capacity && (d.capacity.max_stretch = v))} />
            </Field>
          </div>
        </Section>

        {/* Segments */}
        <Section title="Segment definitions" desc="Per-segment expectations. Paintbrush CV threshold: if quota varies less than this within a segment, we flag it as ‘paintbrushed’ (everyone given the same number).">
          <div className="space-y-1.5">
            <RowHead cols={["Segment", "Quota / pipeline", "Paintbrush CV <"]} />
            {draft.segment_definitions.map((s, i) => (
              <div key={s.name} className="grid grid-cols-3 items-center gap-2">
                <span className="text-xs font-medium text-navy">{s.name}</span>
                <NumberField value={s.expected_quota_to_pipeline} step={0.01} disabled={!editable}
                  onChange={(v) => patch((d) => (d.segment_definitions[i].expected_quota_to_pipeline = v))} />
                <NumberField value={s.paintbrush_cv_threshold} step={0.01} disabled={!editable}
                  onChange={(v) => patch((d) => (d.segment_definitions[i].paintbrush_cv_threshold = v))} />
              </div>
            ))}
          </div>
        </Section>

        {/* Fairness bands */}
        <Section title="Fairness bands" desc="How far a rep's quota-to-opportunity ratio may deviate from the segment median before it falls into the next band (each band's color drives the heatmap).">
          <div className="space-y-1.5">
            <RowHead cols={["Band", "Max deviation ≤"]} />
            {draft.fairness_bands.map((b, i) => (
              <div key={b.name} className="grid grid-cols-2 items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-navy">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                  {b.name}
                </span>
                <NumberField value={b.max_deviation} step={0.05} disabled={!editable}
                  onChange={(v) => patch((d) => (d.fairness_bands[i].max_deviation = v))} />
              </div>
            ))}
          </div>
        </Section>

        {/* Interpretation rules (read-only) */}
        <Section title="Interpretation rules" desc="The reading rules the agents apply for this client. Referenced by name in the assumptions.">
          <div className="space-y-1.5">
            {draft.interpretation_rules.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200/70 bg-slate-50/60 px-2.5 py-1.5">
                <div className="text-xs font-semibold text-ink">{r.label}</div>
                <div className="text-[11px] leading-snug text-slatebody">{r.rule}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* RBAC (read-only) */}
        <Section title="RBAC — field masking by role" desc="What each role sees. Masking is enforced at read time by Shield; every read is logged.">
          <div className="space-y-1.5">
            {draft.rbac_roles.map((r) => (
              <div key={r.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/70 px-2.5 py-1.5">
                <span className="rounded bg-navy/5 px-2 py-0.5 text-xs font-semibold text-navy">{r.name}</span>
                {Object.keys(r.mask).length === 0 ? (
                  <span className="text-[11px] text-band-equitable">full access — nothing masked</span>
                ) : (
                  Object.entries(r.mask).map(([f, lvl]) => (
                    <span key={f} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slatebody">
                      {f}: {lvl}
                    </span>
                  ))
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Stage criteria + model routing (read-only) */}
        <Section title="Stage criteria & model routing" desc="Sales-stage probability anchors, and which Claude model handles simple vs complex reasoning.">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {draft.stage_criteria.map((s) => (
              <span key={s.name} className="chip bg-slate-100 text-slatebody">
                {s.name} ≥ {Math.round(s.min_probability * 100)}%
              </span>
            ))}
          </div>
          {draft.model_routing && (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-xs">
              <div>
                <Label>Default model</Label>
                <div className="font-mono text-[11px] text-navy">{draft.model_routing.default}</div>
              </div>
              <div>
                <Label>Complex model</Label>
                <div className="font-mono text-[11px] text-navy">{draft.model_routing.complex}</div>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="panel-title mb-1">{title}</div>
      <p className="mb-3 text-[11px] leading-snug text-slatebody">{desc}</p>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RowHead({ cols }: { cols: string[] }) {
  const gridCols = cols.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${gridCols} gap-2 border-b border-slate-100 pb-1`}>
      {cols.map((c) => (
        <span key={c} className="font-display text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {c}
        </span>
      ))}
    </div>
  );
}

function NumberField({
  value,
  step,
  disabled,
  onChange,
}: {
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      step={step ?? 1}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-navy outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}
