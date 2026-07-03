"""Shared helper: build Rep models from the masked snapshot, demasking display fields
per RBAC (every read recorded to lineage). Used by all agents."""

from __future__ import annotations

from ..domain.models import Rep
from .base import AgentContext

_MASKING_POLICY = {
    "admin": "Full values — names and emails are fully re-hydrated from the Shield vault.",
    "analyst": "Initials only — e.g. “Liam Rossi” → “L. R.”; emails partially masked.",
    "viewer": "Fully redacted — stable tokens ([PERSON 6]) are kept; no PII revealed.",
}


def build_trace(
    ctx: AgentContext, reps: list[Rep], model_meta: dict, narrative: str, engine_summary: dict,
    extra: dict | None = None, fields_used: list[str] | None = None, computation: str = "",
) -> dict:
    """A per-step technical trace of what actually happened (for the Inspect panel)."""
    sample = []
    for i, rec in enumerate(ctx.masked_reps[:5]):
        r = reps[i] if i < len(reps) else None
        sample.append({
            "rep_id": rec.get("rep_id"),
            "name_stored": rec.get("display_name"),  # token in the DB
            "name_you_see": r.display_name if r else "",  # re-hydrated for your role
            "email_stored": rec.get("email"),
            "email_you_see": r.email if r else "",
        })
    input_sent = model_meta.get("input_sent") or ""
    role = ctx.principal.role
    n = len(ctx.masked_reps)
    origin = {
        "database": "the reps table in the connected database",
        "csv": "an uploaded CSV",
        "synthetic": "the seeded synthetic dataset",
    }.get(ctx.data_source, "the configured data source")
    trace = {
        "pipeline": {
            "source": (
                f"In-memory masked snapshot — loaded from {origin} and masked ONCE at boot. "
                "Each question runs against that snapshot; we do NOT run a new query per question."
            ),
            "rows_available": n,
            "rows_used": n,
            "rows_filtered_out": 0,
            "selection_basis": (
                "Your question selects the AGENT (via semantic classification), not a subset of "
                "rows. The chosen agent's engine always reads every rep."
            ),
            "fields_used": fields_used or [],
            "computation": computation,
            "projection": (
                "The engine's full report is projected down to aggregates (team/segment totals) "
                "+ findings + assumptions — the query-relevant summary."
            ),
            "question_appended": True,
            "payload_bytes": len(input_sent),
            "destination_model": model_meta.get("model") or "deterministic-fallback",
        },
        "shield": {
            "role": role,
            "masking_policy": _MASKING_POLICY.get(role, _MASKING_POLICY["viewer"]),
            "masked_fields": ["display_name", "email"],
            "field_reads": ctx.recorder.field_reads,
            "total_reps_masked": len(ctx.masked_reps),
            "sample": sample,
        },
        "data_selection": {
            "reps_analyzed": len(ctx.masked_reps),
            "raw_rows_sent_to_model": 0,
            "pii_sent_to_model": False,
            "sent_to_model": "an aggregated summary — segment stats + findings + assumptions + your question",
            "model_input_bytes": len(input_sent),
            "note": (
                "The engine computes on ALL reps; Claude only receives the COMPUTED figures "
                "(aggregates & findings), never the raw rep rows and never any PII."
            ),
        },
        "engine": engine_summary,
        "model": {
            "model": model_meta.get("model") or "deterministic-fallback",
            "fell_back": model_meta.get("fell_back", True),
            "system_prompt": (model_meta.get("system_prompt") or "")[:1500],
            "input_sent": model_meta.get("input_sent"),
            "output_received": narrative,
        },
    }
    if extra:
        trace.update(extra)
    return trace


def build_reps(ctx: AgentContext, agent_name: str) -> list[Rep]:
    reps: list[Rep] = []
    for rec in ctx.masked_reps:
        display_name = ctx.masker.demask_value(
            rec.get("display_name", ""), "display_name", ctx.principal,
            ctx.config, ctx.run_id, agent_name, ctx.recorder,
        )
        email = ctx.masker.demask_value(
            rec.get("email", ""), "email", ctx.principal,
            ctx.config, ctx.run_id, agent_name, ctx.recorder,
        )
        reps.append(
            Rep(
                rep_id=rec["rep_id"],
                display_name=display_name or rec.get("display_name", ""),
                email=email or rec.get("email", ""),
                segment=rec["segment"],
                region=rec["region"],
                territory_id=rec.get("territory_id", ""),
                quota=rec["quota"],
                ote=rec.get("ote", 0),
                otc=rec.get("otc", 0),
                pipeline_value=rec["pipeline_value"],
                attainment=rec.get("attainment", 0.0),
            )
        )
    return reps
