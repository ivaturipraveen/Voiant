"""Dashboard service — builds the three pre-built dashboard views.

Territory Equity and Capacity Overview are agent runs surfaced as dashboards; the
Executive Summary aggregates the headline metrics + top findings from both agents.
"""

from __future__ import annotations

from decimal import Decimal

from ..rbac.context import Principal
from ..runtime import AppRuntime
from ..schemas.api import (
    AgentRunResponse,
    ExecMetric,
    ExecutiveSummaryResponse,
    RecommendationItem,
    RecommendationsResponse,
)
from ..schemas.analysis import Assumption
from ..domain.engine import recommendations as rec_engine
from . import analysis_service

_SEVERITY_RANK = {"critical": 0, "warn": 1, "info": 2}

# Server-side cache for the deterministic dashboards. A dashboard depends ONLY on
# (role, config version, data snapshot) — never on the clock or the LLM — so the same
# key always yields the same result. The key includes the config version and snapshot id,
# so editing the config (version bumps) or reloading data (snapshot changes) auto-misses
# and recomputes; no manual invalidation needed.
_CACHE: dict[str, object] = {}


def _cache_key(rt: AppRuntime, name: str, role: str) -> str:
    cfg_v = rt.config_loader.current().version
    snap = rt.snapshot.snapshot_id if rt.snapshot else "none"
    rev = getattr(rt, "data_revision", 0)  # bumps on Shield toggle / re-ingest
    return f"{name}:{role}:v{cfg_v}:{snap}:r{rev}"


# Dashboards are deterministic-only (allow_llm=False) — numbers/charts, no Claude call.
# First compute is cached, so re-opening a tab (or any repeat request) is instant.
def territory_equity(rt: AppRuntime, role: str) -> AgentRunResponse:
    key = _cache_key(rt, "territory", role)
    hit = _CACHE.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]
    res = analysis_service.run_agent(
        rt, "Quota fairness dashboard", role, session_id="dashboard",
        force_agent="quota_equity", allow_llm=False,
    )
    _CACHE[key] = res
    return res


def capacity_overview(rt: AppRuntime, role: str) -> AgentRunResponse:
    key = _cache_key(rt, "capacity", role)
    hit = _CACHE.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]
    res = analysis_service.run_agent(
        rt, "Capacity headroom dashboard", role, session_id="dashboard",
        force_agent="capacity_headroom", allow_llm=False,
    )
    _CACHE[key] = res
    return res


def executive_summary(rt: AppRuntime, role: str) -> ExecutiveSummaryResponse:
    if rt.snapshot is None:
        rt.bootstrap_synthetic()

    key = _cache_key(rt, "executive", role)
    hit = _CACHE.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    qe = analysis_service.run_agent(
        rt, "Executive summary — fairness", role, session_id="dashboard",
        force_agent="quota_equity", allow_llm=False,
    )
    cap = analysis_service.run_agent(
        rt, "Executive summary — capacity", role, session_id="dashboard",
        force_agent="capacity_headroom", allow_llm=False,
    )

    qr = qe.report
    cr = cap.report
    paintbrushed = [s["segment"] for s in qr["segments"] if s["is_paintbrushed"]]

    metrics = [
        ExecMetric(label="Deployed quota", value=_m(qr["deployed_quota"]), tone="neutral"),
        ExecMetric(label="Top-down target", value=_m(qr["top_down_target"]), tone="neutral"),
        ExecMetric(
            label="Over-assignment",
            value=f"{_m(qr['over_assignment'])} ({qr['over_assignment_pct']:.1f}%)",
            tone="danger" if Decimal(qr["over_assignment"]) > 0 else "good",
        ),
        ExecMetric(
            label="Team additional capacity",
            value=f"{_m(cr['team_additional_capacity'])} ({cr['team_additional_capacity_pct']:.1f}%)",
            tone="good",
        ),
        ExecMetric(label="Overloaded reps", value=str(cr["overloaded"]), tone="warn"),
        ExecMetric(
            label="Paintbrushed segments",
            value=", ".join(paintbrushed) if paintbrushed else "none",
            tone="warn" if paintbrushed else "good",
        ),
    ]

    # Top findings across both agents, severity-ranked, capped at 5.
    all_findings = list(qr["findings"]) + list(cr["findings"])
    all_findings.sort(key=lambda f: _SEVERITY_RANK.get(f["severity"], 9))
    top = all_findings[:5]

    narrative = (
        f"This week the organization is carrying {_m(qr['deployed_quota'])} of deployed quota "
        f"against a {_m(qr['top_down_target'])} target. "
        + (f"The {', '.join(paintbrushed)} segment shows paintbrushed quota. " if paintbrushed else "")
        + f"The team could absorb roughly {_m(cr['team_additional_capacity'])} more quota, with "
        f"{cr['overloaded']} reps over-loaded and {cr['underloaded']} under-loaded — a clear "
        f"redistribution opportunity."
    )

    result = ExecutiveSummaryResponse(
        run_id=qe.run_id,
        mock_data=qe.mock_data,
        metrics=metrics,
        top_findings=top,
        narrative=narrative,
        narrative_source="deterministic-aggregate",
        generated_for=Principal.for_role(role).role,
    )
    _CACHE[key] = result
    return result


def recommendations(rt: AppRuntime, role: str) -> RecommendationsResponse:
    if rt.snapshot is None:
        rt.bootstrap_synthetic()

    key = _cache_key(rt, "recommendations", role)
    hit = _CACHE.get(key)
    if hit is not None:
        return hit  # type: ignore[return-value]

    qe = territory_equity(rt, role)
    cap = capacity_overview(rt, role)
    terr = qe.report
    cr = cap.report

    built = rec_engine.build_recommendations(terr, cr, role)
    items = [RecommendationItem(**r.model_dump()) for r in built]
    aggregate = sum(r.impact for r in items)

    assumption_map: dict[str, Assumption] = {}
    for raw in list(terr.get("assumptions") or []) + list(cr.get("assumptions") or []):
        a = Assumption(**raw)
        if a.id not in assumption_map:
            assumption_map[a.id] = a

    paint_seg = next((s["segment"] for s in terr.get("segments", []) if s.get("is_paintbrushed")), None)

    result = RecommendationsResponse(
        run_id=qe.run_id,
        mock_data=qe.mock_data,
        recommendations=items,
        aggregate_impact=aggregate,
        assumptions=list(assumption_map.values()),
        paintbrush_segment=paint_seg,
        has_redistribution=bool(cr.get("redistribution")),
        generated_for=Principal.for_role(role).role,
    )
    _CACHE[key] = result
    return result


def _m(value) -> str:
    return f"${float(Decimal(str(value))) / 1_000_000.0:,.1f}M"
