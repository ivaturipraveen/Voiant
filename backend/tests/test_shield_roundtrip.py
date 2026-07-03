"""Shield mask → token → demask round-trip, with RBAC display masking + lineage."""

from __future__ import annotations

from pathlib import Path

from app.audit.recorder import AuditRecorder
from app.audit.store import AuditStore
from app.db import init_schema, make_engine
from app.rbac.context import Principal
from app.shield.lineage import LineageStore
from app.shield.masking import ShieldMasker
from app.shield.store import ShieldStore
from tests.conftest import FakeShieldClient


def _masker(tmp_path: Path) -> tuple[ShieldMasker, LineageStore]:
    engine = make_engine(None, tmp_path / "t.sqlite")
    init_schema(engine)
    store = ShieldStore(engine)
    client = FakeShieldClient(names=["John Smith", "Maria Patel"])
    masker = ShieldMasker(client, store)
    masker._engine = engine  # test helper: build recorders against the same engine
    return masker, LineageStore(engine)


def _recorder(masker: ShieldMasker, lineage: LineageStore, run_id: str) -> AuditRecorder:
    return AuditRecorder(run_id, AuditStore(masker._engine), lineage)


def test_mask_produces_tokens(tmp_path):
    masker, _ = _masker(tmp_path)
    res = masker.mask_value("John Smith", "display_name", "synthetic")
    assert res.masked == "[PERSON 1]"
    assert res.redacted_count == 1


def test_consistent_token_for_same_value(tmp_path):
    masker, _ = _masker(tmp_path)
    a = masker.mask_value("John Smith", "display_name", "synthetic").masked
    b = masker.mask_value("John Smith", "display_name", "synthetic").masked
    assert a == b == "[PERSON 1]"
    c = masker.mask_value("Maria Patel", "display_name", "synthetic").masked
    assert c == "[PERSON 2]"


def test_admin_demask_restores_original(tmp_path, config):
    masker, lineage = _masker(tmp_path)
    masked = masker.mask_value("John Smith", "display_name", "synthetic").masked
    admin = Principal.for_role("admin")
    rec = _recorder(masker, lineage, "run1")
    out = masker.demask_value(masked, "display_name", admin, config, "run1", "quota_equity", rec)
    rec.flush_lineage()
    assert out == "John Smith"
    assert any(e["field"] == "display_name" for e in lineage.for_run("run1"))


def test_analyst_sees_initials(tmp_path, config):
    masker, lineage = _masker(tmp_path)
    masked = masker.mask_value("John Smith", "display_name", "synthetic").masked
    analyst = Principal.for_role("analyst")
    rec = _recorder(masker, lineage, "run2")
    out = masker.demask_value(masked, "display_name", analyst, config, "run2", "quota_equity", rec)
    assert out == "J. S."


def test_viewer_fully_masked(tmp_path, config):
    masker, lineage = _masker(tmp_path)
    masked = masker.mask_value("John Smith", "display_name", "synthetic").masked
    viewer = Principal.for_role("viewer")
    rec = _recorder(masker, lineage, "run3")
    out = masker.demask_value(masked, "display_name", viewer, config, "run3", "quota_equity", rec)
    assert out == "•••••"
