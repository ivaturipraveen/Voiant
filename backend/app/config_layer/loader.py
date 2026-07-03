"""Load, validate, and hot-reload the client config into an immutable snapshot.

A single snapshot is held behind a lock. POST /config/reload re-reads + re-validates
the YAML and atomically swaps the reference, bumping the version. In-flight analysis
runs keep the snapshot they captured at start (pinned by version) so a reload never
changes a running analysis — and the version is recorded in the audit trail.
"""

from __future__ import annotations

import threading
from pathlib import Path

import yaml

from .schema import ClientConfig


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
    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.RLock()
        self._snapshot: ClientConfig | None = None

    def _read_file(self) -> dict:
        with open(self._path, encoding="utf-8") as f:
            return yaml.safe_load(f)

    def load(self) -> ClientConfig:
        """Load (or reload) from disk, validate, and atomically swap the snapshot."""
        raw = self._read_file()
        with self._lock:
            prev_version = self._snapshot.version if self._snapshot else 0
            # The on-disk file may pin a version; otherwise we monotonically bump.
            file_version = int(raw.get("version", 0) or 0)
            raw["version"] = max(file_version, prev_version + 1)
            cfg = ClientConfig.model_validate(raw)
            self._snapshot = cfg
            return cfg

    def update(self, patch: dict) -> ClientConfig:
        """Apply a partial patch to the LIVE config in memory (validated + atomically
        swapped, version bumped). The on-disk YAML is left untouched — call load()/reload
        to revert to the file. Used by the Configuration page for live demo edits."""
        with self._lock:
            base = self.current().model_dump(mode="json")
            merged = _deep_merge(base, patch or {})
            merged["version"] = (self._snapshot.version if self._snapshot else 0) + 1
            cfg = ClientConfig.model_validate(merged)
            self._snapshot = cfg
            return cfg

    def current(self) -> ClientConfig:
        with self._lock:
            if self._snapshot is None:
                return self.load()
            return self._snapshot

    @property
    def path(self) -> Path:
        return self._path
