#!/usr/bin/env python3
"""Create the tables and seed the `reps` table in the configured database.

Reads the DB URL from the environment (VOIANT_DATABASE_URL, or --url). Idempotent:
won't duplicate reps unless you pass --reset.

Usage (from backend/):
    python scripts/init_db.py                    # create schema + seed if empty
    python scripts/init_db.py --reset            # wipe reps and reseed
    python scripts/init_db.py --url postgresql://user:pass@host/db --reset
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from sqlalchemy import delete, func, insert, select  # noqa: E402

from app.db import init_schema, make_engine  # noqa: E402
from app.db import reps as reps_table  # noqa: E402
from app.settings import get_settings  # noqa: E402
from app.synth import generator  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Create schema + seed reps.")
    ap.add_argument("--seed", type=int, default=42, help="RNG seed (deterministic).")
    ap.add_argument("--reset", action="store_true", help="Wipe the reps table before seeding.")
    ap.add_argument("--url", default=None, help="Override the database URL.")
    args = ap.parse_args()

    s = get_settings()
    url = args.url or s.voiant_database_url
    engine = make_engine(url or None, s.data_dir / "voiant.sqlite")
    init_schema(engine)
    print(f"✅ Schema ready on {'PostgreSQL' if url else 'SQLite'}")

    ds = generator.generate(args.seed)
    with engine.begin() as c:
        if args.reset:
            c.execute(delete(reps_table))
        existing = c.execute(select(func.count()).select_from(reps_table)).scalar() or 0
        if existing and not args.reset:
            print(f"   reps already has {existing} rows — use --reset to reseed. Skipping insert.")
        else:
            c.execute(
                insert(reps_table),
                [
                    {
                        "rep_id": r["rep_id"], "display_name": r["display_name"], "email": r["email"],
                        "segment": r["segment"], "region": r["region"], "territory_id": r["territory_id"],
                        "quota": r["quota"], "ote": r["ote"], "otc": r["otc"],
                        "pipeline_value": r["pipeline_value"], "attainment": r["attainment"],
                    }
                    for r in ds.reps
                ],
            )
            print(f"   Seeded {len(ds.reps)} reps (deployed ${ds.manifest['deployed_quota']/1e6:.1f}M).")

    with engine.connect() as c:
        n = c.execute(select(func.count()).select_from(reps_table)).scalar()
    print(f"   reps table now has {n} rows.")
    print("   Governance tables (shield_map, lineage, audit_inference, audit_llm) are ready.")


if __name__ == "__main__":
    main()
