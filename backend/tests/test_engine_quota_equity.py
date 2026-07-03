"""Golden-master + determinism tests for the Quota Equity engine."""

from __future__ import annotations

from decimal import Decimal

from app.domain.engine import quota_equity as eng
from app.domain.models import Rep


def _reps(dataset):
    return [Rep(**r) for r in dataset.reps]


def test_deployed_vs_target(dataset, config):
    report = eng.compute(_reps(dataset), config)
    assert report.rep_count == 80
    assert report.deployed_quota == Decimal("166000000.06")
    assert report.top_down_target == Decimal("130000000.00")
    assert report.over_assignment == Decimal("36000000.06")
    assert round(report.over_assignment_pct, 2) == 27.69


def test_paintbrush_detection(dataset, config):
    report = eng.compute(_reps(dataset), config)
    paint = [s for s in report.segments if s.is_paintbrushed]
    assert len(paint) == 1
    assert paint[0].segment.value == "Commercial"
    assert paint[0].quota_cv < 0.05


def test_findings_present(dataset, config):
    report = eng.compute(_reps(dataset), config)
    codes = {f.code for f in report.findings}
    assert "DEPLOYED_GT_TARGET" in codes
    assert "PAINTBRUSH_SEGMENT" in codes
    assert "REP_OVERLOADED" in codes
    # The 6 deliberately planted overloaded reps must all be flagged.
    overloaded = {f.subject for f in report.findings if f.code == "REP_OVERLOADED"}
    for rid in ("R006", "R034", "R050", "R058", "R068", "R078"):
        assert rid in overloaded


def test_assumptions_always_present(dataset, config):
    report = eng.compute(_reps(dataset), config)
    assert len(report.assumptions) >= 1


def test_determinism(dataset, config):
    reps = _reps(dataset)
    h1 = eng.report_hash(eng.compute(reps, config), config.version, "snap")
    h2 = eng.report_hash(eng.compute(reps, config), config.version, "snap")
    assert h1 == h2
