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

**PII note:** masking here is **not** for the model (the model never sees PII). It controls **who
sees names/emails in the UI** (by role) and provides the tokens-at-rest audit story.

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
