"""DB access for the client-config table (`client_config`).

Exactly ONE row per client_id. Saving updates that row in place (the `version` field
in the stored `data` bumps by one for display), so there is a single source of truth
per company — no version history, no local config files at runtime.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.engine import Engine

from ..db import client_config


class ConfigStore:
    def __init__(self, engine: Engine):
        self.engine = engine

    def get_active(self, client_id: str) -> dict | None:
        """The single config `data` dict for a client, or None if none exists yet."""
        with self.engine.connect() as c:
            row = c.execute(
                select(client_config.c.data)
                .where(client_config.c.client_id == client_id)
                .order_by(client_config.c.version.desc())
                .limit(1)
            ).first()
        return row[0] if row else None

    def upsert(self, client_id: str, data: dict, source: str) -> dict:
        """Write the client's config to its single row — update in place if it exists,
        insert if not. The stored `data["version"]` bumps by one on each save. Guarantees
        exactly one row per client_id (any stray rows are cleared)."""
        with self.engine.begin() as c:
            current = c.execute(
                select(client_config.c.version)
                .where(client_config.c.client_id == client_id)
                .order_by(client_config.c.version.desc())
                .limit(1)
            ).scalar()
            version = int(current or 0) + 1
            # Collapse to a single row: remove any existing rows for this client, then insert one.
            c.execute(client_config.delete().where(client_config.c.client_id == client_id))
            stored = {**data, "version": version}
            c.execute(
                client_config.insert().values(
                    client_id=client_id,
                    version=version,
                    data=stored,
                    source=source,
                    is_active=True,
                    created_at=datetime.now(UTC),
                )
            )
        return stored
