"""Recommendations — prioritized actions derived from territory + capacity reports."""

from __future__ import annotations

import math
from decimal import Decimal
from typing import Any

from pydantic import BaseModel


class RecommendationItem(BaseModel):
    code: str
    priority: str  # Critical | Priority | Standard
    title: str
    description: str
    tags: list[str]
    impact: float
    effort: str
    confidence: str  # High | Medium | Low — display label for management review


def _m(value: Decimal | float) -> str:
    millions = float(value) / 1_000_000.0
    return f"${millions:,.1f}M"


def _role_name(role: str) -> str:
    return role[:1].upper() + role[1:] if role else "Analyst"


def _plural_unit(n: int, singular: str, plural: str | None = None) -> str:
    p = plural if plural is not None else singular + "s"
    return f"{n} {singular if n == 1 else p}"


def _effort_weeks(weeks: int) -> str:
    return _plural_unit(max(1, weeks), "week")


def _effort_days(days: int) -> str:
    return _plural_unit(max(1, days), "day")


def effort_paintbrush(rep_count: int) -> str:
    """HR-heavy re-tiering scales with reps in the paintbrushed segment (~11 reps per week)."""
    weeks = max(1, min(4, math.ceil(rep_count / 11)))
    return _effort_weeks(weeks)


def effort_redistribution(move_count: int) -> str:
    """Modeled moves are operational — ~3 moves per day of execution."""
    days = max(1, round(move_count / 3))
    return _effort_days(days)


def effort_rebalance(overloaded_count: int) -> str:
    """Per-rep negotiation load; cap at two weeks."""
    days = max(3, min(14, round(overloaded_count * 1.25)))
    if days >= 7:
        return _effort_weeks(max(1, round(days / 7)))
    return _effort_days(days)


def effort_reconcile(over_assignment_pct: float) -> str:
    """Governance / board communication — scales with cushion size."""
    if over_assignment_pct < 15:
        return _effort_days(3)
    if over_assignment_pct < 30:
        return _effort_weeks(1)
    return _effort_weeks(2)


def _merge_findings(terr: dict[str, Any], cap: dict[str, Any]) -> list[dict[str, Any]]:
    return list(terr.get("findings") or []) + list(cap.get("findings") or [])


def _finding_confidence_raw(findings: list[dict[str, Any]], code: str) -> str | None:
    match = next((f for f in findings if f.get("code") == code), None)
    if not match:
        return None
    return str(match.get("confidence", "")).lower() or None


def confidence_label(
    findings: list[dict[str, Any]],
    code: str,
    *,
    default: str = "Medium",
    override: str | None = None,
) -> str:
    """Map engine finding confidence (high/med/low) to management-review label."""
    if override is not None:
        return override
    raw = _finding_confidence_raw(findings, code)
    return {"high": "High", "med": "Medium", "low": "Low"}.get(raw or "", default)


def build_recommendations(terr: dict[str, Any], cap: dict[str, Any], role: str) -> list[RecommendationItem]:
    """Build §04 recommendations; effort and confidence derived from live scope + findings."""
    role_name = _role_name(role)
    findings = _merge_findings(terr, cap)
    recs: list[RecommendationItem] = []

    segments = terr.get("segments") or []
    paint_seg = next((s for s in segments if s.get("is_paintbrushed")), None)
    if paint_seg:
        deployed = Decimal(str(paint_seg["deployed_quota"]))
        rep_count = int(paint_seg["rep_count"])
        per_rep = deployed / rep_count if rep_count else Decimal("0")
        pipeline = Decimal(str(paint_seg["total_pipeline"]))
        seg_name = str(paint_seg["segment"])
        recs.append(
            RecommendationItem(
                code="paintbrush_resegment",
                priority="Critical",
                title=(
                    f"Re-segment {seg_name} from paintbrushed {_m(per_rep)} "
                    f"to tiered A/B/C assignment"
                ),
                description=(
                    f"Assign quotas by opportunity coverage across {rep_count} reps instead of "
                    f"a single uniform figure. Total deployed in the segment is {_m(deployed)} "
                    f"against {_m(pipeline)} of pipeline. Compensation plan may require adjustment "
                    f"for re-tiered reps; HR alignment required before deployment."
                ),
                tags=["Requires HR review", f"Owner: {role_name}", f"Segment: {seg_name}"],
                impact=float(deployed),
                effort=effort_paintbrush(rep_count),
                confidence=confidence_label(findings, "PAINTBRUSH_SEGMENT", default="High"),
            )
        )

    redistribution = cap.get("redistribution") or []
    if redistribution:
        move_count = len(redistribution)
        total_reallocated = sum(Decimal(str(m["amount"])) for m in redistribution)
        rep_by_id = {r["rep_id"]: r["display_name"] for r in (cap.get("per_rep") or [])}
        first = redistribution[0]
        example = (
            f"{rep_by_id.get(first['from_rep'], first['from_rep'])} → "
            f"{rep_by_id.get(first['to_rep'], first['to_rep'])}"
        )
        # Modeled moves with full engine path → High; partial path falls back to finding confidence.
        redist_conf = (
            "High"
            if move_count >= 3
            else confidence_label(findings, "REDISTRIBUTION_AVAILABLE", default="Medium")
        )
        recs.append(
            RecommendationItem(
                code="redistribution",
                priority="Priority",
                title=(
                    f"Redistribute {move_count} quota moves from over-loaded "
                    f"to under-loaded reps"
                ),
                description=(
                    f"Reallocate {_m(total_reallocated)} across {move_count} modeled moves "
                    f"(e.g. {example}). All affected reps land inside the 80–120% load band "
                    f"post-redistribution. Company target coverage is unchanged. "
                    f"No OTE modification required."
                ),
                tags=["No HR required", f"Owner: {role_name}", "Fastest execution"],
                impact=float(total_reallocated),
                effort=effort_redistribution(move_count),
                confidence=redist_conf,
            )
        )

    overloaded_count = int(cap.get("overloaded") or 0)
    if overloaded_count > 0:
        overloaded_reps = [
            r for r in (cap.get("per_rep") or []) if r.get("classification") == "Overloaded"
        ]
        excess = sum(
            max(Decimal("0"), Decimal(str(r.get("load_delta", "0")))) for r in overloaded_reps
        )
        names = ", ".join(r["display_name"] for r in overloaded_reps[:3])
        if len(overloaded_reps) > 3:
            names += ", …"
        plural = "" if overloaded_count == 1 else "s"
        recs.append(
            RecommendationItem(
                code="rebalance_overloaded",
                priority="Priority",
                title=(
                    f"Rebalance {overloaded_count} over-loaded rep{plural} "
                    f"toward the segment median"
                ),
                description=(
                    f"Reps carrying quota well above their segment baseline ({names}) show "
                    f"pipeline coverage that cannot sustain the load. Shift the excess "
                    f"({_m(excess)}) to under-loaded peers in the same segment before quarter close."
                ),
                tags=["No HR required", f"Owner: {role_name}", "Capacity Headroom"],
                impact=float(excess),
                effort=effort_rebalance(overloaded_count),
                confidence=confidence_label(findings, "REPS_OVERLOADED", default="High"),
            )
        )

    over = Decimal(str(terr.get("over_assignment", "0")))
    if over > 0:
        deployed_q = Decimal(str(terr["deployed_quota"]))
        target_q = Decimal(str(terr["top_down_target"]))
        over_pct = float(terr.get("over_assignment_pct", 0))
        recs.append(
            RecommendationItem(
                code="reconcile_target",
                priority="Standard",
                title=(
                    f"Reconcile {_m(deployed_q)} deployed quota against the "
                    f"{_m(target_q)} top-down target"
                ),
                description=(
                    f"Deployed quota exceeds the company target by {_m(over)} ({over_pct:.1f}%). "
                    f"Treat the delta as an explicit, budgeted over-assignment cushion rather than "
                    f"expected attainment, and communicate it as such in board reporting. "
                    f"These remain distinct metrics."
                ),
                tags=["No HR required", f"Owner: {role_name}", "Governance"],
                impact=float(over),
                effort=effort_reconcile(over_pct),
                confidence=confidence_label(
                    findings,
                    "DEPLOYED_GT_TARGET",
                    default="Medium",
                    override="Medium",
                ),
            )
        )

    return recs
