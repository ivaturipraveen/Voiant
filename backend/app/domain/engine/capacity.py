"""Capacity Headroom — deterministic load analysis + what-if scenarios (pure).

A rep's load_index = quota / segment-baseline (segment mean quota). Reps are classified
Underloaded / Balanced / Overloaded; the team's additional capacity is how much more
quota can be added before reps breach the sustainable ceiling. Redistribution suggests
moving quota from overloaded reps to those with headroom. What-if scenarios (cut N reps,
add N heads, headroom query) recompute against the actual data.
"""

from __future__ import annotations

from decimal import Decimal

from ...config_layer.schema import ClientConfig
from ...domain.enums import FlagSeverity
from ...domain.models import Rep
from ...schemas.analysis import Assumption, Finding
from ...schemas.capacity import (
    CapacityReport,
    CapacitySegmentRollup,
    RedistributionMove,
    RepLoad,
    ScenarioOutcome,
)
from .provenance import provenance_assumption
from .stats import mean, r6

Z = Decimal("0")


def _baselines(reps: list[Rep]) -> dict[str, float]:
    by_seg: dict[str, list[float]] = {}
    for r in reps:
        by_seg.setdefault(str(r.segment), []).append(float(r.quota))
    return {seg: mean(vals) for seg, vals in by_seg.items()}


def _classify(load_index: float, cfg: ClientConfig) -> str:
    if load_index >= cfg.capacity.over_threshold:
        return "Overloaded"
    if load_index <= cfg.capacity.under_threshold:
        return "Underloaded"
    return "Balanced"


def compute(reps: list[Rep], config: ClientConfig, data_source: str = "synthetic") -> CapacityReport:
    reps = sorted(reps, key=lambda r: r.rep_id)
    baselines = _baselines(reps)
    cap = config.capacity

    per_rep: list[RepLoad] = []
    for r in reps:
        base = baselines[str(r.segment)]
        base_d = Decimal(str(round(base, 2)))
        load_index = r6(float(r.quota) / base) if base > 0 else 0.0
        ceiling = base * cap.max_stretch
        headroom = max(0.0, ceiling - float(r.quota))
        cls = _classify(load_index, config)
        per_rep.append(
            RepLoad(
                rep_id=r.rep_id,
                display_name=r.display_name,
                segment=r.segment,
                region=r.region,
                quota=r.quota,
                baseline=base_d,
                load_index=load_index,
                load_delta=r.quota - base_d,
                classification=cls,
                headroom=Decimal(str(round(headroom, 2))),
                color=cap.colors.get(cls, "#9CA3AF"),
            )
        )

    team_total = sum((r.quota for r in reps), Z)
    team_additional = sum((rl.headroom for rl in per_rep), Z)
    pct = r6(float(team_additional / team_total) * 100.0) if team_total else 0.0
    overloaded = sum(1 for rl in per_rep if rl.classification == "Overloaded")
    balanced = sum(1 for rl in per_rep if rl.classification == "Balanced")
    underloaded = sum(1 for rl in per_rep if rl.classification == "Underloaded")

    rollups = _rollups(per_rep, baselines)
    redistribution = _redistribution(per_rep, config)
    findings = _findings(team_additional, pct, overloaded, underloaded, redistribution)
    assumptions = _assumptions(config, data_source, len(reps))

    return CapacityReport(
        team_total_quota=team_total,
        team_additional_capacity=team_additional,
        team_additional_capacity_pct=pct,
        rep_count=len(reps),
        overloaded=overloaded,
        balanced=balanced,
        underloaded=underloaded,
        per_rep=per_rep,
        rollups=rollups,
        redistribution=redistribution,
        findings=findings,
        assumptions=assumptions,
    )


def report_hash_payload(report: CapacityReport) -> dict:
    return {
        "team_total": str(report.team_total_quota),
        "team_additional": str(report.team_additional_capacity),
        "counts": [report.overloaded, report.balanced, report.underloaded],
        "per_rep": [[rl.rep_id, rl.load_index, rl.classification] for rl in report.per_rep],
        "redistribution": [[m.from_rep, m.to_rep, str(m.amount)] for m in report.redistribution],
    }


def _rollups(per_rep: list[RepLoad], baselines: dict[str, float]) -> list[CapacitySegmentRollup]:
    by_seg: dict[str, list[RepLoad]] = {}
    for rl in per_rep:
        by_seg.setdefault(str(rl.segment), []).append(rl)
    out: list[CapacitySegmentRollup] = []
    for seg in sorted(by_seg):
        members = by_seg[seg]
        out.append(
            CapacitySegmentRollup(
                segment=members[0].segment,
                rep_count=len(members),
                mean_quota=Decimal(str(round(baselines[seg], 2))),
                total_quota=sum((m.quota for m in members), Z),
                total_headroom=sum((m.headroom for m in members), Z),
                overloaded=sum(1 for m in members if m.classification == "Overloaded"),
                balanced=sum(1 for m in members if m.classification == "Balanced"),
                underloaded=sum(1 for m in members if m.classification == "Underloaded"),
            )
        )
    return out


def _redistribution(per_rep: list[RepLoad], config: ClientConfig) -> list[RedistributionMove]:
    """Greedy: within a segment, move quota from overloaded reps to those with headroom."""
    moves: list[RedistributionMove] = []
    by_seg: dict[str, list[RepLoad]] = {}
    for rl in per_rep:
        by_seg.setdefault(str(rl.segment), []).append(rl)

    for seg in sorted(by_seg):
        members = by_seg[seg]
        ceiling = float(members[0].baseline) * config.capacity.max_stretch
        donors = sorted(
            [(m, float(m.quota) - ceiling) for m in members if float(m.quota) > ceiling],
            key=lambda t: (-t[1], t[0].rep_id),
        )
        receivers = sorted(
            [(m, float(m.headroom)) for m in members if float(m.headroom) > 0],
            key=lambda t: (-t[1], t[0].rep_id),
        )
        ri = 0
        for donor, excess in donors:
            remaining = excess
            while remaining > 1.0 and ri < len(receivers):
                recv, room = receivers[ri]
                take = min(remaining, room)
                if take > 1.0 and recv.rep_id != donor.rep_id:
                    moves.append(
                        RedistributionMove(
                            from_rep=donor.rep_id,
                            to_rep=recv.rep_id,
                            segment=donor.segment,
                            amount=Decimal(str(round(take, 2))),
                        )
                    )
                room -= take
                remaining -= take
                if room <= 1.0:
                    ri += 1
                else:
                    receivers[ri] = (recv, room)
    return moves


def _findings(
    team_additional: Decimal, pct: float, overloaded: int, underloaded: int,
    redistribution: list[RedistributionMove],
) -> list[Finding]:
    findings: list[Finding] = []
    findings.append(
        Finding(
            code="TEAM_HEADROOM",
            severity=FlagSeverity.INFO,
            subject="team",
            message=(
                f"The team can carry approximately ${_m(team_additional)} more quota "
                f"({pct:.1f}% of current deployed) before reps breach the sustainable ceiling."
            ),
            evidence={"additional_capacity": str(team_additional), "pct": pct},
        )
    )
    if overloaded:
        findings.append(
            Finding(
                code="REPS_OVERLOADED",
                severity=FlagSeverity.WARN,
                subject="team",
                message=f"{overloaded} rep(s) are over-loaded and are candidates for redistribution.",
                evidence={"overloaded": overloaded},
            )
        )
    if underloaded:
        findings.append(
            Finding(
                code="REPS_UNDERLOADED",
                severity=FlagSeverity.INFO,
                subject="team",
                message=f"{underloaded} rep(s) are under-loaded and have room to absorb more quota.",
                evidence={"underloaded": underloaded},
            )
        )
    if redistribution:
        moved = sum((m.amount for m in redistribution), Z)
        findings.append(
            Finding(
                code="REDISTRIBUTION_AVAILABLE",
                severity=FlagSeverity.INFO,
                subject="team",
                message=(
                    f"{len(redistribution)} redistribution move(s) could rebalance ~${_m(moved)} "
                    f"of quota from over-loaded to under-loaded reps."
                ),
                evidence={"moves": len(redistribution), "amount": str(moved)},
            )
        )
    return findings


def _assumptions(config: ClientConfig, data_source: str, rep_count: int) -> list[Assumption]:
    return [
        Assumption(
            id="baseline_basis",
            statement="A rep's capacity baseline is the segment mean quota.",
            basis="Capacity load_index = quota / segment mean quota.",
            confidence="med",
        ),
        provenance_assumption(config, data_source, rep_count),
        Assumption(
            id="advisory",
            statement="Hire/cut analysis is advisory only and never names specific terminations.",
            basis="Output discipline for headcount scenarios.",
            confidence="high",
        ),
    ]


# ── What-if scenarios ─────────────────────────────────────────────────────────

def simulate_cut(reps: list[Rep], config: ClientConfig, n: int) -> ScenarioOutcome:
    """Cut the N most under-loaded reps; redistribute their quota across the rest."""
    base = compute(reps, config)
    n = max(0, min(n, len(reps) - 1))
    ordered = sorted(base.per_rep, key=lambda rl: (rl.load_index, rl.rep_id))
    cut = ordered[:n]
    cut_ids = {c.rep_id for c in cut}
    remaining = [r for r in reps if r.rep_id not in cut_ids]
    shed = sum((c.quota for c in cut), Z)
    add_each = (shed / Decimal(len(remaining))) if remaining else Z

    # Recompute load on remaining reps with the extra quota spread evenly.
    bumped = [
        r.model_copy(update={"quota": r.quota + add_each}) for r in remaining
    ]
    after = compute(bumped, config)
    feasible = after.overloaded <= base.overloaded + max(1, len(remaining) // 10)
    return ScenarioOutcome(
        kind="cut_reps",
        params={"n": n},
        summary=(
            f"Cutting {n} under-loaded rep(s) reassigns ${_m(shed)} of quota across "
            f"{len(remaining)} remaining reps (+${_m(add_each)} each). Over-loaded reps go "
            f"from {base.overloaded} to {after.overloaded}. "
            + ("Feasible without major overload." if feasible else "Risk: pushes too many reps into overload.")
        ),
        before={"reps": base.rep_count, "overloaded": base.overloaded,
                "additional_capacity": str(base.team_additional_capacity)},
        after={"reps": after.rep_count, "overloaded": after.overloaded,
               "additional_capacity": str(after.team_additional_capacity)},
        feasible=feasible,
    )


def simulate_add(reps: list[Rep], config: ClientConfig, n: int, region: str | None) -> ScenarioOutcome:
    """Add N heads (at segment-mean baseline) — increases team capacity."""
    base = compute(reps, config)
    n = max(0, n)
    avg_baseline = mean([float(rl.baseline) for rl in base.per_rep]) if base.per_rep else 0.0
    added_capacity = avg_baseline * config.capacity.max_stretch * n
    where = f" in {region}" if region else ""
    return ScenarioOutcome(
        kind="add_heads",
        params={"n": n, "region": region or "all"},
        summary=(
            f"Adding {n} head(s){where} at the ~${_m(Decimal(str(round(avg_baseline,2))))} segment "
            f"baseline adds roughly ${_m(Decimal(str(round(added_capacity,2))))} of carryable quota "
            f"and lowers average rep load."
        ),
        before={"reps": base.rep_count, "additional_capacity": str(base.team_additional_capacity)},
        after={"reps": base.rep_count + n,
               "additional_capacity": str(round(float(base.team_additional_capacity) + added_capacity, 2))},
        feasible=True,
    )


def headroom_query(reps: list[Rep], config: ClientConfig) -> ScenarioOutcome:
    base = compute(reps, config)
    return ScenarioOutcome(
        kind="headroom_query",
        params={},
        summary=(
            f"The team can absorb approximately ${_m(base.team_additional_capacity)} more quota "
            f"({base.team_additional_capacity_pct:.1f}% of current), concentrated in "
            f"{base.underloaded} under-loaded reps."
        ),
        before={"additional_capacity": str(base.team_additional_capacity)},
        after={"additional_capacity": str(base.team_additional_capacity)},
        feasible=True,
    )


def _m(value: Decimal) -> str:
    return f"{float(value) / 1_000_000.0:,.1f}M"
