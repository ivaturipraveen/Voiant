"""Run-scoped recorder handed into agents — bundles audit + lineage under one run_id.

Lineage events are BUFFERED and flushed in a single bulk insert (one DB round-trip per
run instead of one per field read) — essential when the audit store is a remote DB.
"""

from __future__ import annotations

from ..shield.lineage import LineageStore
from .store import AuditStore


class AuditRecorder:
    def __init__(self, run_id: str, audit: AuditStore, lineage: LineageStore):
        self.run_id = run_id
        self._audit = audit
        self.lineage = lineage
        self._field_reads = 0
        self._lineage_buf: list[dict] = []

    def add_lineage(self, agent: str, field: str, record_scope: str, principal_id: str, masking: str) -> None:
        self._lineage_buf.append(
            {"run_id": self.run_id, "agent": agent, "field": field,
             "record_scope": record_scope, "principal_id": principal_id, "masking": masking}
        )
        self._field_reads += 1

    def flush_lineage(self) -> None:
        if self._lineage_buf:
            self.lineage.record_many(self._lineage_buf)
            self._lineage_buf.clear()

    # Back-compat: some callers still count reads explicitly.
    def note_field_read(self, n: int = 1) -> None:
        self._field_reads += n

    @property
    def field_reads(self) -> int:
        return self._field_reads

    def record_inference(
        self, agent: str, agent_version: str, determinism_hash: str,
        config_version: int, mock_data: bool, detail: dict | None = None,
    ) -> None:
        self.flush_lineage()  # persist all buffered field reads first
        self._audit.record_inference(
            self.run_id, agent, agent_version, determinism_hash, config_version,
            self._field_reads, mock_data, detail,
        )

    def record_llm(self, purpose: str, model: str | None, fell_back: bool, detail: dict | None = None) -> None:
        self._audit.record_llm(self.run_id, purpose, model, fell_back, detail)
