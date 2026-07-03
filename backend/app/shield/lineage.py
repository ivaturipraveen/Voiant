"""Data lineage (SQLAlchemy) — which fields were read, when, by which agent, masking.

The "what data fields were read by which agent" audit, captured where data crosses the
PII boundary. Works on Postgres or SQLite via the shared engine.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, insert, select
from sqlalchemy.engine import Engine

from ..db import lineage


class LineageStore:
    def __init__(self, engine: Engine):
        self.engine = engine

    def record_many(self, rows: list[dict]) -> None:
        """Bulk-insert many field-read events in one round-trip (fast on a remote DB)."""
        if not rows:
            return
        now = datetime.now(UTC)
        payload = [{**r, "ts": now} for r in rows]
        with self.engine.begin() as c:
            c.execute(insert(lineage), payload)

    def for_run(self, run_id: str) -> list[dict]:
        with self.engine.connect() as c:
            rows = c.execute(
                select(lineage.c.run_id, lineage.c.agent, lineage.c.field, lineage.c.record_scope,
                       lineage.c.principal_id, lineage.c.masking, lineage.c.ts)
                .where(lineage.c.run_id == run_id).order_by(lineage.c.id)
            ).all()
            return [
                {"run_id": r.run_id, "agent": r.agent, "field": r.field, "record_scope": r.record_scope,
                 "principal_id": r.principal_id, "masking": r.masking, "ts": str(r.ts)}
                for r in rows
            ]

    def summary_for_run(self, run_id: str) -> list[dict]:
        with self.engine.connect() as c:
            rows = c.execute(
                select(
                    lineage.c.agent, lineage.c.field, lineage.c.masking,
                    func.count().label("reads"),
                    func.min(lineage.c.ts).label("first_ts"), func.max(lineage.c.ts).label("last_ts"),
                )
                .where(lineage.c.run_id == run_id)
                .group_by(lineage.c.agent, lineage.c.field, lineage.c.masking)
                .order_by(lineage.c.agent, lineage.c.field)
            ).all()
            return [
                {"agent": r.agent, "field": r.field, "masking": r.masking, "reads": r.reads,
                 "first_ts": str(r.first_ts), "last_ts": str(r.last_ts)}
                for r in rows
            ]
