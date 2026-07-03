"""DB-backed config: seed, reload (no bump), persisted update + orchestrator/narrative fallback."""

from __future__ import annotations

from pathlib import Path

from app.domain.engine import quota_equity as eng
from app.domain.models import Rep

from .conftest import make_config_loader

BACKEND = Path(__file__).resolve().parent.parent


def test_config_seed_and_reload_is_stable(tmp_path):
    """First load seeds from YAML; reload re-fetches the same active version (no bump)."""
    loader = make_config_loader(tmp_path)
    v1 = loader.load().version
    v2 = loader.reload().version
    assert v2 == v1  # reload does NOT bump — only a real update does


def test_config_update_persists_and_bumps_version(tmp_path):
    """update() bumps the version, persists it, and a fresh loader sees the new value."""
    loader = make_config_loader(tmp_path)
    v1 = loader.load().version

    updated = loader.update({"company": {"name": "Rapid7 Updated"}})
    assert updated.version == v1 + 1
    assert updated.company.name == "Rapid7 Updated"

    # Durability: a brand-new loader over the SAME sqlite file reads the persisted
    # active version (no reseed, since an active row already exists).
    fresh = make_config_loader(tmp_path).load()
    assert fresh.version == v1 + 1
    assert fresh.company.name == "Rapid7 Updated"


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
