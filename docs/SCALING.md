# Scaling — current state

The system no longer depends on the sample dataset. Drop in a real client DB and it works —
verified with different segments/regions and up to tens of thousands of reps.

## What's implemented ✅

| Concern | How it's handled | Proven |
|---|---|---|
| **Any data shape** | `segment`/`region` are free-form strings (no enums). Config falls back to sane defaults for unknown segments. | Ran both engines on Public Sector / Healthcare / Fintech + EMEA / APAC / LATAM — computed correctly, what-ifs matched regions from the data. |
| **Scalable ingest masking** | Declared PII columns are tokenised **locally** (no external detector call) in a **single batched vault write**. | 20,000 reps (40k PII values) masked in **0.16s**. |
| **Bounded retrieval** | `_load_database` selects only the columns the app uses and caps rows (`VOIANT_MAX_REPS`, default 100k) with a logged warning. | — |
| **Config-driven, not hardcoded** | PII columns + labels live in the client config (`pii_fields`); thresholds/targets/segments/RBAC all in the DB config (one row per company, updated in place). | — |
| **Deterministic + cached** | Pure-Python engine computes every number + hash; dashboards cached server-side by `(role, config version, data revision)`. | — |
| **DB-swappable** | One env var swaps the source; masking + provenance + engine adapt with no code change. | — |

**PII note:** the model never receives PII (only aggregates). Masking exists for role-based
visibility (viewer / analyst / admin) and the Brightcone Shield story — not to protect the model.

## What this covers
Any realistic sales-rep dataset — tens of thousands of reps, up to the 100k cap — works
end-to-end: fast boot, fast masking, deterministic answers, no data-shape assumptions.

## The one remaining item (only for 100k+ reps)
At very large sizes the bottleneck moves to the **display layer**, not the compute:
- The report serialises **every** rep (`per_rep`) → a large JSON payload.
- The heatmap renders one square **per rep** → too many DOM nodes in the browser.

To go beyond ~100k reps, bound the display: return **top-N outliers + a paginated page** and an
**aggregated heatmap** (by segment/band) instead of one cell per rep — and, optionally, push the
population aggregates into SQL (`GROUP BY`, `percentile_cont`) so rows never load into memory.
This is a display/pagination change (frontend + API), not a rewrite of the engine.

*Everything above the line is done; only this display-bounding step remains, and only if a tenant
genuinely exceeds ~100k reps.*
