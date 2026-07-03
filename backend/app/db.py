"""Database layer — one SQLAlchemy engine + all table definitions.

Portable across PostgreSQL (production / the client DB) and SQLite (local fallback):
if ``VOIANT_DATABASE_URL`` is set we use it; otherwise a local SQLite file. The same
schema and the same store code run on both.

Tables:
  reps              – the source rep dataset (real values)
  shield_map        – reversible PII vault (token ↔ original value)
  shield_counter    – per-entity counter for stable numbered tokens
  lineage           – every field read (who/what/when)
  audit_inference   – every analysis run (hash, config version, counts)
  audit_llm         – every Claude call (model, fell_back)
  client_config     – versioned client configuration ledger (one active row per client)
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.engine import Engine

metadata = MetaData()

reps = Table(
    "reps", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("rep_id", String(64), unique=True, nullable=False, index=True),
    Column("display_name", String(256)),
    Column("email", String(256)),
    Column("segment", String(64)),
    Column("region", String(64)),
    Column("territory_id", String(64)),
    Column("quota", Numeric(18, 2)),
    Column("ote", Numeric(18, 2)),
    Column("otc", Numeric(18, 2)),
    Column("pipeline_value", Numeric(18, 2)),
    Column("attainment", Float),
)

shield_map = Table(
    "shield_map", metadata,
    Column("token", String(128), primary_key=True),
    Column("entity_type", String(64), nullable=False),
    Column("original_value", Text, nullable=False),
    Column("field", String(64)),
    Column("source", String(128)),
    Column("created_at", DateTime),
    UniqueConstraint("entity_type", "original_value", name="uq_shield_entity_value"),
)

shield_counter = Table(
    "shield_counter", metadata,
    Column("entity_type", String(64), primary_key=True),
    Column("n", Integer, nullable=False),
)

lineage = Table(
    "lineage", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", String(64), index=True, nullable=False),
    Column("agent", String(64), nullable=False),
    Column("field", String(64), nullable=False),
    Column("record_scope", Text),
    Column("principal_id", String(64)),
    Column("masking", String(32)),
    Column("ts", DateTime),
)

audit_inference = Table(
    "audit_inference", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", String(64), index=True, nullable=False),
    Column("agent", String(64), nullable=False),
    Column("agent_version", String(32), nullable=False),
    Column("determinism_hash", String(128), nullable=False),
    Column("config_version", Integer, nullable=False),
    Column("field_reads", Integer, nullable=False),
    Column("mock_data", Boolean, nullable=False),
    Column("detail", JSON),
    Column("ts", DateTime),
)

audit_llm = Table(
    "audit_llm", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("run_id", String(64), index=True, nullable=False),
    Column("purpose", String(64), nullable=False),
    Column("model", String(64)),
    Column("fell_back", Boolean, nullable=False),
    Column("detail", JSON),
    Column("ts", DateTime),
)


client_config = Table(
    "client_config", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("client_id", String(64), nullable=False, index=True),
    Column("version", Integer, nullable=False),
    Column("data", JSON, nullable=False),  # full ClientConfig.model_dump(mode="json")
    Column("source", String(32)),  # 'seed' | 'update' | 'reseed'
    Column("is_active", Boolean, nullable=False),
    Column("created_at", DateTime),
    UniqueConstraint("client_id", "version", name="uq_client_config_version"),
)


def normalize_url(url: str) -> str:
    """Ensure a psycopg2 driver for plain postgres URLs (Render gives `postgresql://`)."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url


def make_engine(database_url: str | None, sqlite_path: Path) -> Engine:
    """Return a SQLAlchemy engine: Postgres if a URL is given, else local SQLite."""
    if database_url:
        return create_engine(
            normalize_url(database_url),
            pool_pre_ping=True,
            connect_args={"connect_timeout": 20},
        )
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})


def init_schema(engine: Engine) -> None:
    """Create all tables directly from the metadata (no migrations).

    Used by the test suite (fast, throwaway DBs). The application does NOT call this —
    it runs `upgrade_to_head()` so Alembic is the single owner of the real schema and
    never races with create_all. See migrations/README.md.
    """
    metadata.create_all(engine)


def upgrade_to_head() -> None:
    """Bring the database schema to the latest Alembic revision.

    This is how the app provisions/updates its schema at startup: Alembic owns the
    schema end-to-end, so adding a table + migration never collides with create_all.
    On a fresh DB it creates everything; on an up-to-date DB it's a no-op. The DB URL
    is derived inside migrations/env.py from the same settings the app uses.
    """
    from alembic import command
    from alembic.config import Config

    backend_root = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_root / "migrations"))
    command.upgrade(cfg, "head")
