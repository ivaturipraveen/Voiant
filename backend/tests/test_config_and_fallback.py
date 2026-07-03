"""Config hot-reload version bump + orchestrator/narrative deterministic fallback."""

from __future__ import annotations

import shutil
from pathlib import Path

from app.config_layer.loader import ConfigLoader
from app.domain.engine import quota_equity as eng
from app.domain.models import Rep

BACKEND = Path(__file__).resolve().parent.parent


def test_config_reload_bumps_version(tmp_path):
    src = BACKEND / "config" / "client_rapid7.yaml"
    dst = tmp_path / "cfg.yaml"
    shutil.copy(src, dst)
    loader = ConfigLoader(dst)
    v1 = loader.load().version
    v2 = loader.load().version
    assert v2 == v1 + 1  # monotonic bump on each reload


def test_deterministic_narrative_fallback(dataset, config):
    from app.agents.quota_equity_agent import _deterministic_narrative

    reps = [Rep(**r) for r in dataset.reps]
    report = eng.compute(reps, config)
    text = _deterministic_narrative(report)
    assert "Deployed quota" in text
    assert "Commercial" in text  # paintbrushed segment mentioned
    assert "Assumptions to confirm" in text
    # Numbers in the fallback come straight from the computed report.
    assert "166.0M" in text and "130.0M" in text
