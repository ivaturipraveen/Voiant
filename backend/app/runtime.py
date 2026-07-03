"""Application runtime — wires the singletons (config, shield, audit, llm, dataset).

Built once at startup (FastAPI lifespan) and shared across requests. Holds the active
masked dataset snapshot in memory; the Shield token map / audit / lineage live in SQLite.
"""

from __future__ import annotations

import json
import logging
import uuid

from .audit.store import AuditStore
from .config_layer.loader import ConfigLoader
from .llm.client import LLMClient
from .settings import Settings
from .shield.client import BrightShieldClient
from .shield.lineage import LineageStore
from .shield.masking import ShieldMasker
from .shield.policy import SENSITIVE_FIELDS
from .shield.store import ShieldStore
from .synth import generator

logger = logging.getLogger(__name__)


class DatasetSnapshot:
    def __init__(self, snapshot_id: str, source: str, masked_reps: list[dict], manifest: dict):
        self.snapshot_id = snapshot_id
        self.source = source
        self.masked_reps = masked_reps
        self.manifest = manifest

    @property
    def mock_data(self) -> bool:
        return bool(self.manifest.get("mock_data", True))


class AppRuntime:
    def __init__(self, settings: Settings):
        self.settings = settings
        data_dir = settings.data_dir

        # One SQLAlchemy engine — Postgres if VOIANT_DATABASE_URL is set, else local SQLite.
        # Built first: the config loader is now DB-backed and needs the schema in place.
        from .db import make_engine, upgrade_to_head

        self.engine = make_engine(settings.voiant_database_url or None, data_dir / "voiant.sqlite")
        # Alembic owns the schema — bring it to head (creates everything on a fresh DB,
        # no-op when current). No create_all, so it never collides with migrations.
        upgrade_to_head()

        # Client config lives in the DB (client_config table), seeded from the YAML on
        # first boot. `.load()` fetches the active version into an immutable snapshot.
        self.config_loader = ConfigLoader(
            self.engine, settings.voiant_client_id, seed_path=settings.config_path
        )
        self.config_loader.load()

        self.shield_store = ShieldStore(self.engine)
        self.lineage = LineageStore(self.engine)
        self.audit = AuditStore(self.engine)
        self.shield_client = BrightShieldClient(
            settings.bright_shield_base_url,
            settings.bright_shield_enabled,
            settings.bright_shield_timeout_seconds,
        )
        self.masker = ShieldMasker(self.shield_client, self.shield_store)
        self.llm = LLMClient(
            settings.anthropic_api_key, settings.voiant_model_default, settings.voiant_model_complex,
            settings.voiant_model_classifier,
        )

        self.snapshot: DatasetSnapshot | None = None
        self.data_revision = 0  # bumps on re-ingest (e.g. Shield toggle) → busts dashboard cache

        # Conversation context: session_id -> list of {question, agent, run_id}.
        self._sessions: dict[str, list[dict]] = {}

    # ── Conversation sessions ─────────────────────────────────────────────────
    def ensure_session(self, session_id: str | None) -> str:
        sid = session_id or ("sess-" + uuid.uuid4().hex[:10])
        self._sessions.setdefault(sid, [])
        return sid

    def last_agent(self, session_id: str) -> str | None:
        turns = self._sessions.get(session_id) or []
        return turns[-1]["agent"] if turns else None

    def record_turn(self, session_id: str, question: str, agent: str, run_id: str) -> None:
        self._sessions.setdefault(session_id, []).append(
            {"question": question, "agent": agent, "run_id": run_id}
        )

    def session_memory(self, session_id: str) -> list[dict]:
        """The turns the assistant remembers for this session (for follow-up context + UI)."""
        return list(self._sessions.get(session_id) or [])

    # ── Dataset lifecycle ─────────────────────────────────────────────────────
    def set_shield(self, enabled: bool) -> DatasetSnapshot:
        """Turn Shield masking on/off and re-ingest so the snapshot reflects it. With Shield
        off, PII is stored/shown raw; with it on, PII is tokenised (vault cache → no re-hit
        of the masker API for values already seen). Bumps data_revision to bust caches."""
        self.shield_client.enabled = enabled and bool(self.shield_client.base_url)
        self.shield_client._breaker_open = False
        self.data_revision += 1
        return self.bootstrap(force=True)

    def bootstrap(self, force: bool = False) -> DatasetSnapshot:
        """Load the rep dataset from the configured source and ingest through Shield.
        `force=True` skips the persisted-snapshot fast-path and re-applies masking."""
        source = (self.settings.voiant_data_source or "synthetic").lower()
        try:
            if source == "csv" and self.settings.voiant_data_csv_path:
                records, manifest, snap_id = self._load_csv()
            elif source == "database" and self.settings.voiant_database_url:
                records, manifest, snap_id = self._load_database()
            else:
                records, manifest, snap_id = self._load_synthetic()
        except Exception as e:  # never let a bad source crash startup — fall back to synthetic
            logger.warning("[RUNTIME] Data source '%s' failed (%s); falling back to synthetic", source, e)
            records, manifest, snap_id = self._load_synthetic()
            source = "synthetic"

        # Fast path: reuse a previously-masked snapshot for this exact source so we don't
        # re-mask (and re-hit the masker API) on every boot. Only mask when it's missing.
        persisted = None if force else self._load_persisted_masked(snap_id, len(records))
        if persisted is not None:
            self.snapshot = persisted
            logger.info(
                "[RUNTIME] Reused persisted masked snapshot '%s' (%d reps) — no re-masking.",
                snap_id, len(persisted.masked_reps),
            )
            return persisted

        masked_reps = self._mask_records(records, source=snap_id)
        snapshot = DatasetSnapshot(snapshot_id=snap_id, source=source, masked_reps=masked_reps, manifest=manifest)
        self.snapshot = snapshot
        self._persist(snapshot)
        logger.info(
            "[RUNTIME] Dataset ingested from '%s': %d reps, shield=%s",
            source, len(masked_reps), self.shield_client.status,
        )
        return snapshot

    # Backwards-compatible alias.
    def bootstrap_synthetic(self) -> DatasetSnapshot:
        return self.bootstrap()

    def _load_synthetic(self) -> tuple[list[dict], dict, str]:
        ds = generator.generate(self.settings.voiant_dataset_seed)
        return ds.reps, ds.manifest, "synthetic-seed-" + str(self.settings.voiant_dataset_seed)

    def _load_csv(self) -> tuple[list[dict], dict, str]:
        from pathlib import Path as _Path

        from .connectors.csv_excel import CsvExcelConnector

        path = _Path(self.settings.voiant_data_csv_path)
        if not path.is_absolute():
            path = self.settings.data_dir.parent / path
        content = path.read_bytes()
        result = CsvExcelConnector(content=content, filename=path.name).run(
            content=content, filename=path.name
        )
        manifest = {"mock_data": True, "source": f"csv:{path.name}", "rep_count": len(result.records)}
        return result.records, manifest, f"csv-{path.stem}"

    def _load_database(self) -> tuple[list[dict], dict, str]:
        """Read reps from the SQL database (reuses the shared engine)."""
        from sqlalchemy import text

        from .connectors.normalize import normalize_rows

        q = (self.settings.voiant_db_query or "reps").strip()
        sql = q if " " in q else f"SELECT * FROM {q}"
        with self.engine.connect() as c:
            result = c.execute(text(sql))
            cols = list(result.keys())
            rows = [dict(zip(cols, r, strict=False)) for r in result.fetchall()]
        records, _ = normalize_rows(rows)
        manifest = {"mock_data": self.settings.voiant_mock_data, "source": "database", "rep_count": len(records)}
        return records, manifest, "database"

    def _load_persisted_masked(self, snap_id: str, expected_count: int) -> DatasetSnapshot | None:
        """Load a previously-masked snapshot from disk if it matches this source + size."""
        path = self.settings.data_dir / "snapshot.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        reps = data.get("reps") or []
        if data.get("snapshot_id") != snap_id or len(reps) != expected_count:
            return None
        return DatasetSnapshot(
            snapshot_id=snap_id, source=data.get("source", ""), masked_reps=reps,
            manifest=data.get("manifest", {}),
        )

    def _mask_records(self, records: list[dict], source: str) -> list[dict]:
        """Mask sensitive fields through Shield (parallelized; order + tokens preserved)."""
        from concurrent.futures import ThreadPoolExecutor

        def _mask(rec: dict) -> dict:
            masked, _ = self.masker.mask_record(rec, SENSITIVE_FIELDS, source=source)
            return masked

        if self.shield_client.status == "active":
            with ThreadPoolExecutor(max_workers=12) as pool:
                return list(pool.map(_mask, records))
        return [_mask(rec) for rec in records]

    def set_snapshot(self, snapshot: DatasetSnapshot) -> None:
        self.snapshot = snapshot
        self._persist(snapshot)

    def _persist(self, snapshot: DatasetSnapshot) -> None:
        out = self.settings.data_dir / "snapshot.json"
        out.write_text(
            json.dumps(
                {"snapshot_id": snapshot.snapshot_id, "source": snapshot.source,
                 "manifest": snapshot.manifest, "reps": snapshot.masked_reps},
                indent=2, default=str,
            ),
            encoding="utf-8",
        )

    def new_run_id(self) -> str:
        return uuid.uuid4().hex[:12]

    @property
    def shield_status(self) -> str:
        return self.shield_client.status
