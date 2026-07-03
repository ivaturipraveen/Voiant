"""DB access for the versioned client-config ledger (`client_config` table).

One active row per client_id; each save inserts a new version and demotes the
previous active row. The stored `data` is the full ClientConfig JSON dump, with
its `version` field kept in sync with the row's version column.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from ..db import client_config


class ConfigStore:
    def __init__(self, engine: Engine):
        self.engine = engine

    def get_active(self, client_id: str) -> dict | None:
        """The active config `data` dict for a client, or None if none exists yet."""
        with self.engine.connect() as c:
            row = c.execute(
                select(client_config.c.data)
                .where(
                    client_config.c.client_id == client_id,
                    client_config.c.is_active.is_(True),
                )
                .order_by(client_config.c.version.desc())
                .limit(1)
            ).first()
        return row[0] if row else None

    def insert_version(self, client_id: str, data: dict, source: str) -> dict:
        """Insert `data` as the new active version (demoting the prior active row).

        Version = max(existing) + 1, computed inside the transaction so the stored
        `data["version"]` matches the row. Retries on a unique-constraint clash
        (two workers racing for the same version number). Returns the stored data.
        """
        for _ in range(3):
            try:
                with self.engine.begin() as c:
                    maxv = c.execute(
                        select(func.max(client_config.c.version)).where(
                            client_config.c.client_id == client_id
                        )
                    ).scalar()
                    version = int(maxv or 0) + 1
                    c.execute(
                        update(client_config)
                        .where(
                            client_config.c.client_id == client_id,
                            client_config.c.is_active.is_(True),
                        )
                        .values(is_active=False)
                    )
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
            except IntegrityError:
                continue
        raise RuntimeError(
            f"could not insert a new config version for client '{client_id}' after retries"
        )

    def list_versions(self, client_id: str) -> list[dict]:
        """Version history (newest first) — metadata only, not the full payload."""
        with self.engine.connect() as c:
            rows = c.execute(
                select(
                    client_config.c.version,
                    client_config.c.source,
                    client_config.c.is_active,
                    client_config.c.created_at,
                )
                .where(client_config.c.client_id == client_id)
                .order_by(client_config.c.version.desc())
            ).all()
        return [
            {"version": r[0], "source": r[1], "is_active": bool(r[2]), "created_at": r[3]}
            for r in rows
        ]
