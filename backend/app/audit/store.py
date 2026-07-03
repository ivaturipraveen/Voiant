"""Append-only audit store (SQLAlchemy) — every inference + every LLM call, by run_id.

Works on Postgres or SQLite via the shared engine — this is where "runs info" persists.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import insert, select
from sqlalchemy.engine import Engine

from ..db import audit_inference, audit_llm


class AuditStore:
    def __init__(self, engine: Engine):
        self.engine = engine

    def record_inference(
        self, run_id: str, agent: str, agent_version: str, determinism_hash: str,
        config_version: int, field_reads: int, mock_data: bool, detail: dict | None = None,
    ) -> None:
        with self.engine.begin() as c:
            c.execute(
                insert(audit_inference).values(
                    run_id=run_id, agent=agent, agent_version=agent_version,
                    determinism_hash=determinism_hash, config_version=config_version,
                    field_reads=field_reads, mock_data=mock_data, detail=detail or {},
                    ts=datetime.now(UTC),
                )
            )

    def record_llm(
        self, run_id: str, purpose: str, model: str | None, fell_back: bool, detail: dict | None = None
    ) -> None:
        with self.engine.begin() as c:
            c.execute(
                insert(audit_llm).values(
                    run_id=run_id, purpose=purpose, model=model, fell_back=fell_back,
                    detail=detail or {}, ts=datetime.now(UTC),
                )
            )

    def for_run(self, run_id: str) -> dict:
        with self.engine.connect() as c:
            inf = c.execute(
                select(audit_inference).where(audit_inference.c.run_id == run_id).order_by(audit_inference.c.id)
            ).mappings().all()
            llm = c.execute(
                select(audit_llm).where(audit_llm.c.run_id == run_id).order_by(audit_llm.c.id)
            ).mappings().all()
            return {
                "run_id": run_id,
                "inferences": [dict(r) for r in inf],
                "llm_calls": [dict(r) for r in llm],
            }
