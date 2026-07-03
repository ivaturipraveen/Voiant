"""Shared test fixtures."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

# Keep tests offline + deterministic.
os.environ.setdefault("BRIGHT_SHIELD_ENABLED", "false")
os.environ.setdefault("ANTHROPIC_API_KEY", "")

from app.config_layer.loader import ConfigLoader  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent
SEED_YAML = BACKEND / "config" / "client_rapid7.yaml"


def make_config_loader(tmp_path) -> ConfigLoader:
    """A DB-backed ConfigLoader over a fresh temp SQLite, seeded from the YAML."""
    from app.db import init_schema, make_engine

    engine = make_engine(None, tmp_path / "voiant.sqlite")
    init_schema(engine)
    return ConfigLoader(engine, "rapid7", seed_path=SEED_YAML)


@pytest.fixture
def config(tmp_path):
    return make_config_loader(tmp_path).load()


@pytest.fixture
def dataset():
    from app.synth import generator

    return generator.generate(42)


class FakeShieldClient:
    """Detects 'Person' entities by matching known names; deterministic, offline."""

    status = "active"

    def __init__(self, names: list[str]):
        self._names = names

    def pii_text_detection(self, text: str) -> list[dict]:
        out = []
        for n in self._names:
            idx = text.find(n)
            if idx != -1:
                out.append(
                    {"entity_type": "Person", "entity_text": n, "start": idx, "end": idx + len(n), "score": 0.99}
                )
        return out
