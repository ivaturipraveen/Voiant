"""Load, validate, and version the client config — backed by the database.

The active config lives in the `client_config` table (one row per version, one
active per client). On first boot for a client with no rows, the loader SEEDS the
DB from the YAML file (kept in git as the human-readable starting point). At
runtime the DB is authoritative.

A single validated snapshot is held in memory behind a lock and pinned by version,
so an in-flight analysis keeps the snapshot it captured at start; the version is
recorded in the audit trail. `update()` persists a new version; `reload()` re-fetches
the active row from the DB (picking up changes made by another worker/instance).
"""

from __future__ import annotations

import threading
from pathlib import Path

import yaml
from sqlalchemy.engine import Engine

from .schema import ClientConfig
from .store import ConfigStore


def _deep_merge(base: dict, patch: dict) -> dict:
    """Recursively merge patch into base. Dicts merge key-by-key; everything else
    (including lists) is replaced wholesale by the patch value."""
    out = dict(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class ConfigLoader:
    def __init__(self, engine: Engine, client_id: str, seed_path: Path | None = None):
        self._store = ConfigStore(engine)
        self._client_id = client_id
        self._seed_path = seed_path
        self._lock = threading.RLock()
        self._snapshot: ClientConfig | None = None

    def _read_seed_file(self) -> dict:
        if not self._seed_path:
            raise FileNotFoundError("no seed config file configured")
        with open(self._seed_path, encoding="utf-8") as f:
            return yaml.safe_load(f)

    def load(self) -> ClientConfig:
        """Fetch the active config from the DB (seeding from YAML on first boot),
        validate, and cache it as the snapshot. Does NOT bump the version."""
        with self._lock:
            data = self._store.get_active(self._client_id)
            if data is None:
                # First boot for this client — seed the DB from the YAML file.
                raw = self._read_seed_file()
                raw["client_id"] = raw.get("client_id", self._client_id)
                cfg = ClientConfig.model_validate(raw)  # validate BEFORE persisting
                data = self._store.upsert(
                    self._client_id, cfg.model_dump(mode="json"), source="seed"
                )
            cfg = ClientConfig.model_validate(data)
            self._snapshot = cfg
            return cfg

    def update(self, patch: dict) -> ClientConfig:
        """Apply a partial patch to the live config, validate, and PERSIST it by updating
        the client's single config row in place (version bumps by one)."""
        with self._lock:
            base = self.current().model_dump(mode="json")
            merged = _deep_merge(base, patch or {})
            cfg = ClientConfig.model_validate(merged)  # validate BEFORE persisting
            data = self._store.upsert(
                self._client_id, cfg.model_dump(mode="json"), source="update"
            )
            cfg = ClientConfig.model_validate(data)
            self._snapshot = cfg
            return cfg

    # Backwards-compatible name: "reload" now means "re-fetch the active row from DB".
    def reload(self) -> ClientConfig:
        return self.load()

    def current(self) -> ClientConfig:
        with self._lock:
            if self._snapshot is None:
                return self.load()
            return self._snapshot

    @property
    def client_id(self) -> str:
        return self._client_id
