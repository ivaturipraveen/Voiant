"""Capacity Headroom engine + what-if scenario tests."""

from __future__ import annotations

from app.domain.engine import capacity as cap
from app.domain.engine.stats import determinism_hash
from app.domain.models import Rep


def _reps(dataset):
    return [Rep(**r) for r in dataset.reps]


def test_capacity_basic(dataset, config):
    report = cap.compute(_reps(dataset), config)
    assert report.rep_count == 80
    assert report.overloaded + report.balanced + report.underloaded == 80
    assert report.team_additional_capacity >= 0
    # Every rep classified and colored.
    assert all(rl.classification in ("Underloaded", "Balanced", "Overloaded") for rl in report.per_rep)


def test_capacity_determinism(dataset, config):
    reps = _reps(dataset)
    h1 = determinism_hash(cap.report_hash_payload(cap.compute(reps, config)))
    h2 = determinism_hash(cap.report_hash_payload(cap.compute(reps, config)))
    assert h1 == h2


def test_redistribution_moves_from_overloaded(dataset, config):
    report = cap.compute(_reps(dataset), config)
    over_ids = {rl.rep_id for rl in report.per_rep if rl.classification == "Overloaded"}
    for m in report.redistribution:
        assert m.from_rep in over_ids
        assert m.amount > 0


def test_whatif_cut(dataset, config):
    out = cap.simulate_cut(_reps(dataset), config, 3)
    assert out.kind == "cut_reps"
    assert out.params["n"] == 3
    assert out.before["reps"] == 80
    assert out.after["reps"] == 77


def test_whatif_add(dataset, config):
    out = cap.simulate_add(_reps(dataset), config, 5, "West")
    assert out.kind == "add_heads"
    assert out.after["reps"] == 85
    assert out.feasible is True


def test_headroom_query(dataset, config):
    out = cap.headroom_query(_reps(dataset), config)
    assert out.kind == "headroom_query"
    assert "additional_capacity" in out.after
