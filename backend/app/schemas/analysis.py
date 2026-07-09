"""Pydantic DTOs for analysis results (engine output + agent report)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from ..domain.enums import FairnessBand, FlagSeverity


class Assumption(BaseModel):
    """An "assumption to confirm" — surfaced with every analysis."""

    id: str
    statement: str
    basis: str
    confidence: str  # "low" | "med" | "high"


class Finding(BaseModel):
    """A flag raised by the engine, with the exact evidence behind it."""

    code: str  # e.g. PAINTBRUSH_SEGMENT, REP_OVERLOADED, DEPLOYED_GT_TARGET
    severity: FlagSeverity
    subject: str  # segment name | rep_id | "company"
    message: str
    evidence: dict[str, str | float | int]


class FairnessResult(BaseModel):
    rep_id: str
    display_name: str
    email: str
    segment: str
    region: str
    quota: Decimal
    opportunity: Decimal
    fairness_ratio: float  # quota / opportunity
    segment_median_ratio: float
    deviation: float  # signed deviation from segment median ratio
    band: FairnessBand


class HeatmapCell(BaseModel):
    rep_id: str
    display_name: str
    segment: str
    region: str
    fairness_ratio: float
    deviation: float
    band: FairnessBand
    color: str


class SegmentSummary(BaseModel):
    segment: str
    rep_count: int
    deployed_quota: Decimal
    total_pipeline: Decimal
    quota_cv: float  # coefficient of variation of quota within the segment
    is_paintbrushed: bool
    company_target: Decimal
    over_assignment: Decimal
    over_assignment_pct: float


class QuotaEquityReport(BaseModel):
    deployed_quota: Decimal  # sum of rep quotas
    top_down_target: Decimal  # company target from config
    over_assignment: Decimal  # deployed - target
    over_assignment_pct: float
    rep_count: int
    per_rep: list[FairnessResult]
    heatmap: list[HeatmapCell]
    segments: list[SegmentSummary]
    findings: list[Finding]
    assumptions: list[Assumption]
