"""Quota Equity — the deterministic source of truth.

Pure functions only: no IO, no LLM, no clock. Given frozen Rep models + the client
config, computes deployed-vs-target, per-rep fairness, paintbrush detection, the
heatmap, findings, and assumptions, plus a determinism hash over the canonical output.
The LLM later narrates over this object but never alters a number.
"""

from __future__ import annotations

from decimal import Decimal

from ...config_layer.schema import ClientConfig
from ...domain.enums import FairnessBand, FlagSeverity
from ...domain.models import Rep
from ...schemas.analysis import (
    Assumption,
    FairnessResult,
    Finding,
    HeatmapCell,
    QuotaEquityReport,
    SegmentSummary,
)
from . import fairness as F
from .provenance import provenance_assumption
from .stats import coefficient_of_variation, determinism_hash, median, r6


def compute(reps: list[Rep], config: ClientConfig, data_source: str = "synthetic") -> QuotaEquityReport:
    reps = sorted(reps, key=lambda r: r.rep_id)
    bands = config.fairness_bands

    deployed = sum((r.quota for r in reps), Decimal("0"))
    target = config.company.top_down_target
    over = deployed - target
    over_pct = r6(float(over / target) * 100.0) if target else 0.0

    # Group reps by segment.
    by_segment: dict[str, list[Rep]] = {}
    for r in reps:
        by_segment.setdefault(str(r.segment), []).append(r)

    # Per-segment median fairness ratio + paintbrush detection.
    seg_median_ratio: dict[str, float] = {}
    segments: list[SegmentSummary] = []
    for seg_name in sorted(by_segment):
        members = by_segment[seg_name]
        ratios = [F.fairness_ratio(float(m.quota), float(m.pipeline_value)) for m in members]
        seg_median_ratio[seg_name] = median(ratios)
        quotas = [float(m.quota) for m in members]
        cv = coefficient_of_variation(quotas)
        seg_def = config.segment_def(seg_name)
        threshold = seg_def.paintbrush_cv_threshold if seg_def else 0.05
        segments.append(
            SegmentSummary(
                segment=members[0].segment,
                rep_count=len(members),
                deployed_quota=sum((m.quota for m in members), Decimal("0")),
                total_pipeline=sum((m.pipeline_value for m in members), Decimal("0")),
                quota_cv=cv,
                is_paintbrushed=cv < threshold,
            )
        )

    # Per-rep fairness + heatmap.
    per_rep: list[FairnessResult] = []
    heatmap: list[HeatmapCell] = []
    for r in reps:
        seg = str(r.segment)
        ratio = F.fairness_ratio(float(r.quota), float(r.pipeline_value))
        med = seg_median_ratio[seg]
        dev = F.deviation_from_median(ratio, med)
        band = F.band_for_deviation(dev, bands)
        color = F.color_for_band(band, bands)
        per_rep.append(
            FairnessResult(
                rep_id=r.rep_id,
                display_name=r.display_name,
                email=r.email,
                segment=r.segment,
                region=r.region,
                quota=r.quota,
                opportunity=r.pipeline_value,
                fairness_ratio=ratio,
                segment_median_ratio=med,
                deviation=dev,
                band=band,
                trend_6w=F.fairness_trend_6w(ratio, med),
            )
        )
        heatmap.append(
            HeatmapCell(
                rep_id=r.rep_id,
                display_name=r.display_name,
                segment=r.segment,
                region=r.region,
                fairness_ratio=ratio,
                deviation=dev,
                band=band,
                color=color,
            )
        )

    findings = _build_findings(deployed, target, over, over_pct, segments, per_rep, config)
    assumptions = _assumptions(config, data_source, len(reps))

    report = QuotaEquityReport(
        deployed_quota=deployed,
        top_down_target=target,
        over_assignment=over,
        over_assignment_pct=over_pct,
        rep_count=len(reps),
        per_rep=per_rep,
        heatmap=heatmap,
        segments=segments,
        findings=findings,
        assumptions=assumptions,
    )
    return report


def report_hash(report: QuotaEquityReport, config_version: int, snapshot_id: str) -> str:
    """Canonical hash over the numeric content (order-stable, narrative-independent)."""
    payload = {
        "config_version": config_version,
        "snapshot_id": snapshot_id,
        "deployed": str(report.deployed_quota),
        "target": str(report.top_down_target),
        "over_pct": report.over_assignment_pct,
        "per_rep": [
            [fr.rep_id, fr.fairness_ratio, fr.deviation, fr.band.value]
            for fr in report.per_rep
        ],
        "segments": [
            [s.segment, s.quota_cv, s.is_paintbrushed] for s in report.segments
        ],
        "findings": [[f.code, f.subject, f.severity.value] for f in report.findings],
    }
    return determinism_hash(payload)


def _build_findings(
    deployed: Decimal,
    target: Decimal,
    over: Decimal,
    over_pct: float,
    segments: list[SegmentSummary],
    per_rep: list[FairnessResult],
    config: ClientConfig,
) -> list[Finding]:
    findings: list[Finding] = []

    # 1. Deployed > target.
    if over > 0:
        findings.append(
            Finding(
                code="DEPLOYED_GT_TARGET",
                severity=FlagSeverity.CRITICAL,
                subject="company",
                message=(
                    f"Deployed quota (${_m(deployed)}) exceeds the top-down target "
                    f"(${_m(target)}) by ${_m(over)} ({over_pct:.1f}%). These are distinct "
                    f"metrics and should not be conflated."
                ),
                evidence={
                    "deployed_quota": str(deployed),
                    "top_down_target": str(target),
                    "over_assignment": str(over),
                    "over_assignment_pct": over_pct,
                },
                source_agent="Quota Equity",
                confidence="high",
                impact_label=f"${_m(over)}",
                trend_6w=F.linear_trend_6w(float(target), float(deployed)),
            )
        )

    # 2. Paintbrushed segments (sorted by name for stable order).
    for s in sorted(segments, key=lambda x: x.segment):
        if s.is_paintbrushed:
            seg_trends = [fr.trend_6w for fr in per_rep if fr.segment == s.segment]
            findings.append(
                Finding(
                    code="PAINTBRUSH_SEGMENT",
                    severity=FlagSeverity.WARN,
                    subject=s.segment,
                    message=(
                        f"The {s.segment} segment shows near-uniform quota across "
                        f"{s.rep_count} reps (coefficient of variation {s.quota_cv:.3f}), "
                        f"a 'paintbrushed' assignment that ignores territory differences."
                    ),
                    evidence={
                        "segment": s.segment,
                        "rep_count": s.rep_count,
                        "quota_cv": s.quota_cv,
                    },
                    source_agent="Quota Equity",
                    confidence="high",
                    impact_label=f"${_m(s.deployed_quota)}",
                    trend_6w=F.average_trends_6w(seg_trends) if seg_trends else F.linear_trend_6w(1.0, 1.0),
                )
            )

    # 3. Overloaded reps (sorted by deviation desc, then rep_id).
    overloaded = [fr for fr in per_rep if fr.band == FairnessBand.OVERLOADED]
    overloaded.sort(key=lambda fr: (-fr.deviation, fr.rep_id))
    for fr in overloaded:
        fair_quota = float(fr.opportunity) * fr.segment_median_ratio
        excess = max(0.0, float(fr.quota) - fair_quota)
        findings.append(
            Finding(
                code="REP_OVERLOADED",
                severity=FlagSeverity.WARN,
                subject=fr.rep_id,
                message=(
                    f"{fr.rep_id} carries quota {fr.deviation * 100:.0f}% above the "
                    f"{fr.segment} segment median relative to pipeline — overloaded."
                ),
                evidence={
                    "rep_id": fr.rep_id,
                    "segment": fr.segment,
                    "fairness_ratio": fr.fairness_ratio,
                    "segment_median_ratio": fr.segment_median_ratio,
                    "deviation": fr.deviation,
                },
                source_agent="Quota Equity",
                confidence="med",
                impact_label=f"${_m(Decimal(str(round(excess, 2))))}" if excess > 0 else "—",
                trend_6w=fr.trend_6w,
            )
        )

    return findings


def _assumptions(config: ClientConfig, data_source: str, rep_count: int) -> list[Assumption]:
    """Always-present 'assumptions to confirm'. Each is derived from config/data, not
    hardcoded — the opportunity basis quotes the client ledger rule, provenance reflects
    the live data source, and the target quotes company.top_down_target from config."""
    opp_rule = _rule_text(config, "opportunity_basis", "A rep's opportunity = pipeline_value.")
    return [
        Assumption(
            id="opportunity_basis",
            statement=f"Rep opportunity is measured by open pipeline_value. ({opp_rule})",
            basis="Interpretation rule 'opportunity_basis' in the client ledger.",
            confidence="med",
        ),
        provenance_assumption(config, data_source, rep_count),
        Assumption(
            id="target_source",
            statement=f"Top-down target is ${_m(config.company.top_down_target)} from the client config.",
            basis="company.top_down_target in the interpretation-rules ledger.",
            confidence="high",
        ),
    ]


def _rule_text(config: ClientConfig, rule_id: str, default: str) -> str:
    for r in config.interpretation_rules:
        if r.id == rule_id:
            return r.rule
    return default


def _m(value: Decimal) -> str:
    """Human money formatting in millions, deterministic."""
    millions = float(value) / 1_000_000.0
    return f"{millions:,.1f}M"
