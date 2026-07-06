# Voiant — How it works (technical flow)

A simple, end-to-end walk-through of what happens from a question to an answer.

> **The one idea to remember:** a **deterministic engine computes every number**; the **AI only
> (1) understands the question and (2) explains the numbers in plain English.** The model never
> does the math, never sees a rep row, and never sees PII. That's what makes answers **exact,
> repeatable, and safe.**

There are two phases: **A —** the data is loaded **once at boot**, and **B —** each question is
answered against that in-memory copy.

---

## Phase A — Load the data once (at boot)

```
        ┌──────────────────────────┐
        │   reps table (client DB)  │
        └────────────┬──────────────┘
                     │   read only the columns we use, capped (VOIANT_MAX_REPS)
                     ▼
        ┌──────────────────────────┐
        │   Mask the PII columns    │   which columns are PII is set in the CONFIG
        │   (names, emails)         │   (per client, not hardcoded)
        │   batched · local · fast  │   → no per-row calls to an external service
        └───────┬───────────────┬───┘
                │               │
                ▼               ▼
   ┌────────────────────┐   ┌──────────────────────────────┐
   │  Shield vault       │   │  In-memory snapshot           │
   │  token ↔ real value │   │  tokens only — NO raw PII     │
   │  [PERSON 6]↔L. Rossi│   │  the working copy for the app │
   └────────────────────┘   └──────────────────────────────┘
```

- Runs **once** at startup. Every question then reads this in-memory snapshot — **we never
  re-query the database per question.**
- Scales to tens of thousands of reps (masking is a single batched write, not N network calls).
- Swap the client's database (`VOIANT_DATABASE_URL`) and it just works — any segments/regions,
  PII columns declared in config.

---

## Phase B — Answer a question

Example used throughout: **"What if we add 5 heads in the West region?"** · role **admin**

```
   You ask a question in plain English
            │
            ▼
   1. CLASSIFY            (AI · small model)   → picks the specialist by MEANING, no keywords
            │                                     → "Capacity Headroom", 95% confident
            ▼
   2. PARSE INPUT         (deterministic)      → pulls the numbers from the text
            │                                     → add 5 heads, region = West
            ▼
   3. READ + UN-MASK      (per your role)       → reads the snapshot; shows names per role
            │                                     (admin: full · analyst: initials · viewer: hidden)
            ▼
   4. COMPUTE             (engine · pure Python)→ every number + finding, + a determinism hash
            │                                     → team can carry $26.6M more; +5 in West → $38.5M
            ▼
   5. BUILD THE PAYLOAD   (aggregates only)     → a small summary — 0 rep rows, 0 PII (~2 KB)
            │
            ▼
   6. EXPLAIN             (AI · Claude)          → writes the plain-English answer over those
            │                                     numbers — never invents one
            ▼
   7. RESPOND + AUDIT                            → charts render from the numbers; the run is logged
```

Only steps **1** and **6** use the AI. Steps **2–5** are deterministic — same question, same numbers.

---

## The steps in words

1. **Classify** — a small fast model (Claude Haiku) reads the *meaning* and picks the agent
   (Quota Equity or Capacity Headroom). Vague follow-ups ("what about the west?") use the recent
   conversation to stay on the right agent. *No keyword matching.*
2. **Parse input** — for what-ifs, the parameters are pulled from the text by simple rules
   (regex + trigger words) — e.g. *add 5 heads in West* → `n=5, region=West`. Not the AI.
3. **Read + un-mask** — the reps are read from the in-memory snapshot and names/emails are
   re-hydrated **to the level your role allows** (admin = full, analyst = initials, viewer =
   hidden). Every read is logged for audit.
4. **Compute** — a pure-Python engine calculates everything (fairness bands, paintbrush flags,
   team headroom, the what-if outcome) and stamps a hash so the same question always gives the
   same figures.
5. **Build the payload** — the results are boiled down to a small JSON summary (segment totals,
   findings, the question). **No rep rows and no PII are included.**
6. **Explain** — Claude turns those numbers into a readable answer. Its instructions forbid it
   from computing or inventing any number. If the AI is unavailable, a built-in template writes
   the same answer from the same numbers.
7. **Respond + audit** — the charts render from the computed numbers; the run (hash, model call,
   field reads) is logged to the audit trail.

---

## What the model actually receives

Only the computed summary — never rows, never PII:

```json
{ "deployed_quota": "166000000", "top_down_target": "130000000", "over_assignment_pct": 27.7,
  "segments": [ { "segment": "Enterprise", "quota_cv": 0.18, "is_paintbrushed": false }, … ],
  "findings":  [ { "code": "REPS_OVERLOADED", "message": "8 reps are over-loaded…" }, … ],
  "scenario":  { "kind": "add_heads", "n": 5, "region": "West", "after": "$38.5M" },
  "user_question": "What if we add 5 heads in the West region?" }
```

---

## How we retrieve the data today (and how it scales)
*(for discussion with the client)*

**Current behavior**
- **At boot: one SQL query.** `_load_database()` runs a single `SELECT <columns> FROM reps LIMIT <cap>`
  once, masks it, and holds it as an **in-memory snapshot**.
- **Per question: zero SQL.** Every question computes over that **already-loaded in-memory data** —
  we do **not** hit the database again.

> **SQL once at startup; in-memory for every question after that.**

**Why it's built this way.** The analytics are **population-level, not lookups** — fairness needs
the *segment median*, "paintbrush" needs the *CV across the whole segment*, deployed quota is the
*sum of everyone*. There's nothing to "search for": the engine must see the whole population.
Holding it in memory makes that fast and **deterministic** (same question → same hash), and for the
realistic range (up to the ~**100k** cap) it's sub-second.

**For very large data (100k+).** Loading everything into memory and computing in Python over all
rows gets heavy (memory + boot time + a large payload). At that scale the right move is to **push
the aggregation into SQL** — the database computes the aggregates and we fetch results, not rows:

```sql
SELECT segment,
       COUNT(*), SUM(quota), AVG(quota),
       STDDEV_POP(quota) / AVG(quota)                                    AS quota_cv,     -- paintbrush
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY quota / pipeline_value) AS median_ratio
FROM reps
GROUP BY segment;
```

Then only a **page of detail rows** (top-N outliers) is pulled — never all rows into memory. That
scales to millions.

**The decision comes down to one number:**
- **≤ ~100k reps** (essentially every sales-*rep* dataset — even a huge enterprise rarely has 100k
  salespeople): the current **in-memory** approach is the right, simpler, deterministic choice.
- **100k+ reps per client:** switch on the **SQL-aggregation path** (compute in the DB, fetch
  aggregates + a page) so it's truly unbounded.

---

## PII — what we receive, what we send, and is it needed?
*(for discussion with the client)*

- **What we receive:** the client's rep dataset, including PII columns (names, emails).
- **What we send to the model:** **only computed aggregates — 0 rep rows, 0 PII.** The model never
  receives a name or email.
- **So is PII masking needed here?** Since the model never sees PII, masking is **not** to protect
  the model. It exists for two other reasons — **keep it only if the client wants them:**
  1. **Role-based visibility** in the UI — admin sees full names, analyst sees initials, viewer sees
     nothing. Real access control on the display.
  2. **Tokens-at-rest / audit story** — the working copy stores tokens, not PII, and every read is
     logged (the "Powered by Brightcone Shield" compliance angle).
- If neither matters for a given client, masking can be simplified or turned off (there's already a
  **Shield on/off** toggle) — the numbers and the model behaviour are identical either way.

---

## Why a client can trust it

| Guarantee | How |
|---|---|
| Same question → same numbers | Deterministic engine + a hash over its output |
| The AI can't invent figures | The engine computes everything; the model is told to explain only |
| No PII ever reaches the AI | Only aggregates are sent — 0 rows, 0 PII |
| Everything is audited | Field reads, each run, and each model call are logged |
| Works on any client's data | Segments/regions are free-form; PII columns + thresholds live in config |
| Nothing hardcoded | Targets, thresholds, PII columns, model routing — all in the DB config |

---

## Where it lives (Postgres tables)

| Table | Holds |
|---|---|
| `reps` | The sales-rep dataset |
| `shield_map` | The token ↔ real-value vault |
| `lineage` | Every field read (who / which agent / when / masking) |
| `audit_inference` | One row per analysis run (question, hash, config version) |
| `audit_llm` | One row per model call |
| `client_config` | One row per client — targets, thresholds, segments, RBAC, PII columns |
