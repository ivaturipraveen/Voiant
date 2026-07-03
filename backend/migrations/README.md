# Database migrations (Alembic)

Schema is defined once as a SQLAlchemy `MetaData` in [`app/db.py`](../app/db.py).
Alembic's `env.py` targets that same metadata, so `--autogenerate` diffs migrations
against the live table definitions. The database URL is **not** in `alembic.ini` —
`env.py` derives it exactly like the app (`VOIANT_DATABASE_URL` if set, else the local
SQLite file at `data/voiant.sqlite`), so migrations always run against the app's DB.

Run every command from the `backend/` directory (use `uv run` so the venv is active).

## Everyday commands

```bash
# Apply all pending migrations (fresh DB, or after pulling new ones)
uv run alembic upgrade head

# Where is this DB right now?
uv run alembic current

# History of migrations
uv run alembic history

# Roll back one migration
uv run alembic downgrade -1
```

Point at a specific database by exporting the URL first:

```bash
VOIANT_DATABASE_URL="postgresql://user:pass@host:5432/voiant" uv run alembic upgrade head
```

## Making a schema change

1. Edit the table definitions in [`app/db.py`](../app/db.py).
2. Autogenerate a migration:
   ```bash
   uv run alembic revision --autogenerate -m "add reps.manager_id"
   ```
3. **Review** the generated file in `versions/` — autogenerate is a draft. SQLite can't
   do most in-place `ALTER`s, so column changes are emitted via `batch_alter_table`
   (already enabled in `env.py`); check those blocks and fill in any data backfill.
4. Apply it:
   ```bash
   uv run alembic upgrade head
   ```
5. Commit the new file in `versions/` alongside the `app/db.py` change.

## Alembic is the sole owner of the schema

The application runs `db.upgrade_to_head()` at startup (`app/runtime.py`), which is just
`alembic upgrade head` in-process. On a fresh database it creates every table; when the
DB is current it's a no-op. There is **no** `create_all` in the app path, so adding a
table + migration can never collide with startup provisioning. (`init_schema()` /
`create_all` still exists but is used only by the test suite for throwaway DBs.)

## Baselining a database created before this change

A database that was previously provisioned by the old `create_all` startup has the tables
but its Alembic version row may be behind (or missing). Reconcile it **once** so Alembic's
version matches what's physically there — this does **not** re-run DDL:

```bash
uv run alembic stamp head
```

After that, startup's `upgrade_to_head()` (and any manual `alembic upgrade head`) applies
only genuinely new migrations. Symptom that you need this: `DuplicateTable ... already
exists` on upgrade — the table exists but Alembic thinks it must still create it.

## Notes

- **SQLite** local dev uses batch mode automatically for `ALTER`s.
- **PostgreSQL** (Render) gets native DDL; the same migration files work on both — SQLAlchemy renders dialect-appropriate SQL at apply time.
- Offline SQL (for a DBA to review/apply): `uv run alembic upgrade head --sql`.
