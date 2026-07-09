"""Pydantic DTOs for the Capacity Headroom agent."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from .analysis import Assumption, Finding


class RepLoad(BaseModel):
    rep_id: str
    display_name: str
    segment: str
    region: str
    quota: Decimal
    baseline: Decimal  # segment mean quota
    load_index: float  # quota / baseline
    load_delta: Decimal  # quota - baseline (drives the two-sided bar)
    classification: str  # Underloaded | Balanced | Overloaded
    headroom: Decimal  # how much more quota this rep can absorb (>= 0)
    color: str


class CapacitySegmentRollup(BaseModel):
    segment: str
    rep_count: int
    mean_quota: Decimal
    total_quota: Decimal
    total_headroom: Decimal
    overloaded: int
    balanced: int
    underloaded: int


class RedistributionMove(BaseModel):
    from_rep: str
    to_rep: str
    from_rep_name: str
    to_rep_name: str
    segment: str
    amount: Decimal  # quota to move from an overloaded rep to one with headroom
    context: str
    from_was_pct: str
    from_new_pct: str
    to_was_pct: str
    to_new_pct: str


class ScenarioOutcome(BaseModel):
    kind: str  # cut_reps | add_heads | headroom_query
    params: dict[str, str | int]
    summary: str
    before: dict[str, str | float | int]
    after: dict[str, str | float | int]
    feasible: bool


class CapacityReport(BaseModel):
    team_total_quota: Decimal
    team_additional_capacity: Decimal  # how much more quota the team can carry
    team_additional_capacity_pct: float
    rep_count: int
    overloaded: int
    balanced: int
    underloaded: int
    qoq_balanced: int
    qoq_overloaded: int
    qoq_underloaded: int
    per_rep: list[RepLoad]
    rollups: list[CapacitySegmentRollup]
    redistribution: list[RedistributionMove]
    findings: list[Finding]
    assumptions: list[Assumption]
    scenario: ScenarioOutcome | None = None
