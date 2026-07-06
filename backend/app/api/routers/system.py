"""System / Behind-the-Scenes router — exposes the platform internals for the demo:
agent library, model routing, Shield status, connectors, dataset manifest, pipeline."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...agents import registry
from ...connectors.registry import discover_all
from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(prefix="/system", tags=["system"])

PIPELINE_STEPS = [
    {"step": "Question", "detail": "The user asks in plain English — no fixed commands or syntax."},
    {"step": "Classify", "detail": "A small fast model reads the MEANING and picks the right specialist agent (no keyword matching). Vague follow-ups use conversation memory."},
    {"step": "Parse input", "detail": "Deterministic regex + keywords pull any what-if parameters (e.g. add 5 heads in West → n=5, region=West). Not the model."},
    {"step": "Shielded read", "detail": "Rep data is read through Shield — PII re-hydrated per RBAC role; every field read logged to lineage."},
    {"step": "Compute", "detail": "A pure-Python engine computes EVERY number & finding over all reps, then emits a determinism hash (same question → identical figures)."},
    {"step": "Assemble payload", "detail": "Only the computed aggregates + findings + your question are serialized to JSON — 0 raw rep rows, 0 PII ever leave for the model."},
    {"step": "Model explains", "detail": "Claude turns the computed numbers into plain-English narrative — it never computes or invents figures. Sonnet default, Opus for complex/what-ifs."},
    {"step": "Audit & respond", "detail": "The run is logged (hash, config version, field reads); charts + reasoning + assumptions are returned."},
]


def _dataset_stats(rt: AppRuntime, cfg, snap) -> dict:
    """Compute the loaded-dataset stats from the actual reps + engines (source-agnostic)."""
    base = {
        "rep_count": len(snap.masked_reps) if snap else 0,
        "mock_data": snap.mock_data if snap else True,
        "snapshot_id": snap.snapshot_id if snap else None,
        "deployed_quota": None, "top_down_target": None, "paintbrush_segment": None,
        "overloaded_rep_ids": [], "segments": [], "regions": [],
    }
    if not snap or not snap.masked_reps:
        return base
    from ...domain.engine import capacity as cap_engine
    from ...domain.engine import quota_equity as qe_engine
    from ...domain.models import Rep

    reps = [
        Rep(
            rep_id=r["rep_id"], display_name=r.get("display_name", ""), email=r.get("email", ""),
            segment=r["segment"], region=r["region"], territory_id=r.get("territory_id", ""),
            quota=r["quota"], ote=r.get("ote", 0), otc=r.get("otc", 0),
            pipeline_value=r["pipeline_value"], attainment=r.get("attainment", 0.0),
        )
        for r in snap.masked_reps
    ]
    qe = qe_engine.compute(reps, cfg)
    cap = cap_engine.compute(reps, cfg)
    base.update({
        "deployed_quota": str(qe.deployed_quota),
        "top_down_target": str(qe.top_down_target),
        "paintbrush_segment": next((s.segment for s in qe.segments if s.is_paintbrushed), None),
        "overloaded_rep_ids": [rl.rep_id for rl in cap.per_rep if rl.classification == "Overloaded"],
        "segments": sorted({str(x.segment) for x in qe.segments}),
        "regions": sorted({r.region for r in reps}),
    })
    return base


@router.get("")
def system(rt: AppRuntime = Depends(get_runtime)) -> dict:
    cfg = rt.config_loader.current()
    snap = rt.snapshot
    dataset = _dataset_stats(rt, cfg, snap)
    return {
        "platform": {
            "shield": {"status": rt.shield_status, "base_url": rt.settings.bright_shield_base_url},
            "llm": {
                "enabled": rt.llm.enabled,
                "default_model": rt.settings.voiant_model_default,
                "complex_model": rt.settings.voiant_model_complex,
                "routing": "Haiku classifies intent (semantic, no keywords); Sonnet narrates standard answers; Opus handles complex reasoning / what-if scenarios / synthesis.",
            },
            "config": {"client_id": cfg.client_id, "client_name": cfg.client_name, "version": cfg.version},
            "dataset": dataset,
        },
        "agents": {
            "registered": registry.describe(),
            "library": registry.AGENT_LIBRARY,
        },
        "connectors": discover_all(),
        "pipeline": PIPELINE_STEPS,
        "shield_tokens": _balanced_token_sample(rt.shield_store.all_tokens(), per_type=6),
        "shield_token_summary": _token_summary(rt.shield_store.all_tokens()),
    }


def _token_summary(tokens: list[dict]) -> dict:
    counts: dict[str, int] = {}
    for t in tokens:
        et = t.get("entity_type") or "OTHER"
        counts[et] = counts.get(et, 0) + 1
    return {"total": len(tokens), "by_type": counts}


def _balanced_token_sample(tokens: list[dict], per_type: int = 6) -> list[dict]:
    """Interleave a few tokens of EACH entity type so the sample is representative
    (not 12 rows of the same type). Deterministic — preserves stored order within a type."""
    by_type: dict[str, list[dict]] = {}
    for t in tokens:
        by_type.setdefault(t.get("entity_type") or "OTHER", []).append(t)
    heads = {k: v[:per_type] for k, v in by_type.items()}
    out: list[dict] = []
    for i in range(per_type):
        for et in sorted(heads):  # stable type order
            if i < len(heads[et]):
                out.append(heads[et][i])
    return out
