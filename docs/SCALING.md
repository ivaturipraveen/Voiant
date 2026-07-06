# Scaling to production data volumes

## The problem with the current (POC) flow

Today, on boot we `SELECT * FROM reps`, then **mask every rep's PII** (name/email/phone) through
the masker, and hold the masked snapshot in memory. That is fine for 80 reps but does not scale:

- **Masking is O(reps).** 50,000 reps × ~2 PII fields ≈ 100,000 masker calls **at boot**. Slow,
  fragile, and expensive.
- **`SELECT *` pulls every column and row** into memory, including columns nothing needs.
- **Everything is recomputed/re-held** regardless of what the question actually needs.

## The key principle

Separate the two very different needs:

| Need | Data required | Cost |
|---|---|---|
| **The math** (fairness, capacity, aggregates) | `quota, pipeline_value, segment, region, attainment` — **all non-PII** | Cheap; can be done in SQL |
| **The display** (a table row, a tooltip) | `display_name, email` — **PII** | Expensive to mask, but only needed for the **few rows shown** |

> **Compute on the whole population's *numbers* (no PII, or in SQL). Mask only the handful of rows
> you actually display.** Masking then scales with *screen size*, not *dataset size*.

Fairness/capacity are **population-relative** (segment medians, CV, totals), so you can't just fetch
"the rows for this query" — but you fetch **aggregates**, not raw rows, and you never mask what you
don't show.

## Target architecture

```
Question ──▶ Planner: which agent + what data does it need?
                    │
                    ▼
         DataRequest { columns, filters, aggregations, page }
                    │
                    ▼
    Repository.retrieve(DataRequest)  ── builds the SQL command
        • analytics  → GROUP BY / window funcs → aggregates (no rows, no PII)
        • detail page → SELECT <non-PII cols> WHERE … LIMIT/OFFSET
                    │
                    ▼
        Deterministic engine computes on the numbers
                    │
                    ▼
    Report references reps by rep_id only (no PII in the report or the model payload)
                    │
                    ▼
    Display resolver: for the ≤N rep_ids actually shown, fetch + mask PII per role
        (bounded — one small query + a few masker calls, cached)
```

### 1. A Repository / data-access layer (the seam)
Introduce `RepRepository` with source-specific implementations (Postgres, CSV, synthetic):

```python
class RepRepository(Protocol):
    def aggregates(self, req: AggRequest) -> SegmentStats: ...        # SQL GROUP BY
    def page(self, req: PageRequest) -> list[RepNumbers]: ...          # non-PII columns, paginated
    def resolve_pii(self, rep_ids: list[str], principal) -> dict: ...  # bounded + masked, per role
```

The agent/planner produces the `DataRequest`; the repository **finalizes the SQL command** for the
active source. This is the "identify the query → build the retrieve command" step, done properly.

### 2. Push aggregation into SQL for large data
Instead of loading all rows to compute in Python:

```sql
-- deployed vs target, per-segment spread (CV), counts — computed by the database
SELECT segment,
       COUNT(*)                              AS rep_count,
       SUM(quota)                            AS deployed_quota,
       AVG(quota)                            AS mean_quota,
       STDDEV_POP(quota) / NULLIF(AVG(quota),0) AS quota_cv,   -- paintbrush signal
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY quota/NULLIF(pipeline_value,0)) AS median_ratio
FROM reps
GROUP BY segment;
```

The engine consumes these aggregates (still deterministic, still hashed). Only the **outlier / page**
rows are pulled individually.

### 3. Bounded, lazy masking (the big win)
- **Never mask at boot.** The DB is the secure system of record.
- The engine works on **numeric columns only** — no PII touched, so boot is O(1) in masker calls.
- When a view needs names (outlier table, tooltip), call `resolve_pii(rep_ids_shown, role)` — mask
  **only those ≤N rows**, cache them. PII still never reaches the model (only aggregates do).

### 4. Caching & freshness
- Cache aggregates by `(query, config_version, data_revision)` (already done for dashboards).
- Cache resolved+masked display rows by `(rep_id, role)`.
- Invalidate on config change / data reload (we already bump `data_revision`).

## Migration path (phased, low-risk)

| Phase | Change | Effect |
|---|---|---|
| **1** | Column-selective retrieval: `SELECT <needed cols>` (not `*`); add a safety `LIMIT`/row-cap with a logged warning | Less memory/IO; no behaviour change |
| **2** | Stop masking at boot; engine loads **non-PII numerics**; add `resolve_pii()` for display; mask only shown rows | Boot no longer O(reps); masker calls drop from thousands to dozens |
| **3** | Push aggregates to SQL (`GROUP BY`, window funcs); fetch aggregates + one page of detail | Never loads all rows; scales to millions |
| **4** | Pagination/virtualized tables in the UI; server returns pages, not full `per_rep` | Bounded payloads end-to-end |

Phases 1–2 give ~all the practical benefit for tens of thousands of reps and keep the deterministic
engine unchanged. Phase 3 is for very large tenants.

## What stays the same (the guarantees)
- **Determinism** — the engine still computes every number and emits the hash.
- **PII never reaches the model** — it only ever gets aggregates.
- **RBAC + lineage** — masking/role rules unchanged; just applied to fewer rows, later.
- **Config-driven & DB-swappable** — the repository is per-source; swapping the DB changes only the
  connection, not the contract.
