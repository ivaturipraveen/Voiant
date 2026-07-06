"""Persistent Shield token vault (SQLAlchemy — Postgres or SQLite).

Holds the reversible mapping between an original sensitive value and its stable numbered
token (e.g. "John Smith" → "[PERSON 1]"). An in-memory cache is loaded once at startup so
repeated boots and known values need no DB round-trips (fast even against a remote DB).
The mapping is consistent: the same (entity_type, original_value) always maps to the same
token.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.engine import Engine

from ..db import shield_counter, shield_map


class ShieldStore:
    def __init__(self, engine: Engine):
        self.engine = engine
        self._lock = threading.RLock()
        self._by_pair: dict[tuple[str, str], str] = {}
        self._by_token: dict[str, str] = {}
        self._by_value: dict[str, str] = {}
        self._counters: dict[str, int] = {}
        self._load()

    def _load(self) -> None:
        with self.engine.connect() as c:
            for r in c.execute(select(shield_map.c.token, shield_map.c.entity_type, shield_map.c.original_value)):
                self._by_pair[(r.entity_type, r.original_value)] = r.token
                self._by_token[r.token] = r.original_value
                self._by_value[r.original_value] = r.token
            for r in c.execute(select(shield_counter.c.entity_type, shield_counter.c.n)):
                self._counters[r.entity_type] = r.n

    def token_for(self, entity_type: str, original_value: str, field: str, source: str) -> str:
        """Get or mint a stable token for a value. Same value → same token."""
        with self._lock:
            key = (entity_type, original_value)
            existing = self._by_pair.get(key)
            if existing:
                return existing
            n = self._counters.get(entity_type, 0) + 1
            token = f"[{entity_type.upper()} {n}]"
            with self.engine.begin() as c:
                updated = c.execute(
                    update(shield_counter).where(shield_counter.c.entity_type == entity_type).values(n=n)
                ).rowcount
                if not updated:
                    c.execute(insert(shield_counter).values(entity_type=entity_type, n=n))
                c.execute(
                    insert(shield_map).values(
                        token=token, entity_type=entity_type, original_value=original_value,
                        field=field, source=source, created_at=datetime.now(UTC),
                    )
                )
            self._counters[entity_type] = n
            self._by_pair[key] = token
            self._by_token[token] = original_value
            self._by_value[original_value] = token
            return token

    def mint_batch(
        self, items: list[tuple[str, str, str]], source: str
    ) -> dict[tuple[str, str], str]:
        """Mint tokens for many (entity_type, value, field) triples in ONE transaction.

        Returns {(entity_type, value): token}. Already-vaulted values reuse their token; new
        values are numbered sequentially per entity_type and bulk-inserted. This is what makes
        ingest scale — masking N reps is a single DB round-trip, not N transactions.
        """
        with self._lock:
            result: dict[tuple[str, str], str] = {}
            new_rows: list[dict] = []
            new_counters: dict[str, int] = {}
            now = datetime.now(UTC)
            for etype, value, field in items:
                key = (etype, value)
                if key in result:
                    continue
                existing = self._by_pair.get(key)
                if existing is not None:
                    result[key] = existing
                    continue
                n = new_counters.get(etype, self._counters.get(etype, 0)) + 1
                new_counters[etype] = n
                token = f"[{etype.upper()} {n}]"
                result[key] = token
                new_rows.append({
                    "token": token, "entity_type": etype, "original_value": value,
                    "field": field, "source": source, "created_at": now,
                })
            if new_rows:
                with self.engine.begin() as c:
                    for etype, n in new_counters.items():
                        updated = c.execute(
                            update(shield_counter).where(shield_counter.c.entity_type == etype).values(n=n)
                        ).rowcount
                        if not updated:
                            c.execute(insert(shield_counter).values(entity_type=etype, n=n))
                    c.execute(insert(shield_map), new_rows)  # bulk executemany
                for row in new_rows:
                    et, val, tok = row["entity_type"], row["original_value"], row["token"]
                    self._by_pair[(et, val)] = tok
                    self._by_token[tok] = val
                    self._by_value[val] = tok
                self._counters.update(new_counters)
            return result

    def token_for_value(self, value: str) -> str | None:
        """Return an existing token if this exact value is already vaulted (skips Shield)."""
        return self._by_value.get(value)

    def original_for(self, token: str) -> str | None:
        return self._by_token.get(token)

    def all_tokens(self) -> list[dict]:
        with self.engine.connect() as c:
            rows = c.execute(
                select(shield_map.c.token, shield_map.c.entity_type, shield_map.c.field,
                       shield_map.c.source, shield_map.c.created_at).order_by(shield_map.c.created_at)
            ).all()
            return [
                {"token": r.token, "entity_type": r.entity_type, "field": r.field,
                 "source": r.source, "created_at": str(r.created_at)}
                for r in rows
            ]

    def count(self) -> int:
        with self.engine.connect() as c:
            return c.execute(select(func.count()).select_from(shield_map)).scalar() or 0

    def reset(self) -> None:
        with self._lock, self.engine.begin() as c:
            c.execute(delete(shield_map))
            c.execute(delete(shield_counter))
        self._by_pair.clear()
        self._by_token.clear()
        self._by_value.clear()
        self._counters.clear()
