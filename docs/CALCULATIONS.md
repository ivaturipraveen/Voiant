# Voiant — Backend calculations (step by step)

Exactly how every number is computed, and how each one becomes a chart on screen. All math
runs in a **pure, deterministic Python engine** (`app/domain/engine/`) — no AI, no clock, no
hardcoded business values. Inputs are the **rep rows (from the DB)** + the **client config
(from the DB)**; the output is a report object the dashboards render directly.

> **Nothing here is hardcoded.** Every threshold/target comes from the client config
> (`client_config` table); every baseline is derived from the data. Change the data or the
> config and every number below recomputes.

---

## The agents (what we have and what each is for)

| Agent | What it does | Useful for |
|---|---|---|
| **Quota Equity** | Fairness of quota assignment: deployed vs top-down target, per-segment "paintbrush" detection, per-rep fairness ratio → band + heatmap. | "Is quota fair?", "Which segment is paintbrushed?", "Who's over/under-assigned?" |
| **Capacity Headroom** | Team load & capacity: per-rep load vs a sustainable ceiling, how much more quota the team can carry, redistribution moves, hire/cut what-ifs. | "How much more can we carry?", "Who's overloaded?", "What if we add 5 reps in West?" |
| **Scenario Orchestrator** | Routes each question to the right agent, keeps conversation context for follow-ups, and **synthesizes** one answer when a question spans both fairness and capacity. | "Give me the overall health", vague follow-ups ("what about the west?") |

*Planned (designed, not in the POC): Territory Intelligence, Pipeline Hygiene, Comp Expense — they
slot into the same agent registry with no change to the orchestrator.*

Each agent is: **RBAC-shielded read → deterministic engine (the math) → audit → Claude narrates.**
The engine produces the numbers; Claude only explains them.

---

## End to end: what happens for one query (in order)

Example question: **"Is each rep's quota fair given their territory's opportunity?"** · role `admin`.

**Step 1 — Query received.** `POST /agents/chat` with `{ question, role, session_id }`
(`api/routers/agents.py` → `services/analysis_service.py::run_agent`). A session is looked up so
follow-ups keep context.

**Step 2 — Classify the intent (AI #1).** A small model (Claude Haiku) reads the *meaning* and
returns JSON `{agent, confidence, reason}` — no keywords (`orchestrator.plan` → `llm.classify`).
The exact classifier prompt is in *"The exact prompts we send"* below.
→ here: `{"agent": "quota_equity", "confidence": 0.95, "reason": "asks about quota fairness"}`.

**Step 3 — Parse input (deterministic, not the model).** For capacity what-ifs, parameters are
pulled from the text by regex + trigger words (e.g. *add 5 heads in West* → `n=5, region=West`).
The quota question has no parameters. (`capacity_headroom_agent::_detect_scenario`.)

**Step 4 — Get the data (from the in-memory snapshot, loaded once from the DB at boot).** The
chosen agent reads the rep rows and **re-hydrates PII per role** from the Shield vault (admin →
full names, analyst → initials, viewer → hidden); every field read is logged to `lineage`. **No new
DB query runs per question.** (`agents/_reps.py::build_reps`.)

**Step 5 — Compute (the deterministic engine — the math).** `engine.compute(reps, config)` runs
the calculations in sections **A / B** below and stamps a determinism hash. The run is written to
`audit_inference` *before* any narration.

**Step 6 — Build the payload (what actually goes to the model).** The report is projected to a
compact JSON of **aggregates only** + the `user_question`. **No rep rows, no names, no PII.**
Example of the exact input sent:
```json
{ "deployed_quota": "166000000", "top_down_target": "130000000", "over_assignment_pct": 27.7,
  "rep_count": 80,
  "segments": [ { "segment": "Commercial", "quota_cv": 0.0, "is_paintbrushed": true }, … ],
  "findings": [ { "code": "DEPLOYED_GT_TARGET", "severity": "critical", "message": "…" }, … ],
  "assumptions": [ … ],
  "user_question": "Is each rep's quota fair given their territory's opportunity?" }
```

**Step 7 — Send to the model (AI #2).** Claude gets the JSON + the agent's **narrative prompt**
(verbatim below), which forbids computing/inventing numbers. Model routing: Opus for complex /
what-if, Sonnet otherwise. If Claude is unavailable, a deterministic template writes the same
answer. The call is logged to `audit_llm`.

**Step 8 — Respond.** The API returns `report` (all numbers) + `narrative` (the model's prose) +
`determinism_hash` + `trace`. The dashboards/charts render from `report`; the narrative is shown as
prose. **Nothing visual reads the model's text.**

> Two AI touchpoints only: **Step 2 (classify)** and **Step 7 (explain)**. Steps 3–6 are
> deterministic — same question → same numbers.

---

## Inputs

**Per rep** (from the `reps` table): `rep_id, segment, region, quota, pipeline_value, ote, otc,
attainment` (+ masked `display_name, email` for display only — never used in the math).

**Config levers** (from `client_config`, editable on the Configuration page):
`company.top_down_target`, per-segment `paintbrush_cv_threshold`, `fairness_bands[].max_deviation`,
`capacity.over_threshold / under_threshold / max_stretch`.

**Rounding (determinism):** ratios/deviations → `r6()` = 6 dp via `Decimal` half-up; money →
2 dp `Decimal`. This is why the same input always yields the same output + hash.

---

## A. Quota Equity engine  (`domain/engine/quota_equity.py`)

Answers: *is quota assigned fairly?*

**Step 1 — Deployed vs target**
```
deployed_quota   = Σ rep.quota                     (over all reps)
top_down_target  = config.company.top_down_target
over_assignment  = deployed_quota − top_down_target
over_pct         = over_assignment / top_down_target × 100
```

**Step 2 — Group reps by segment** (segment is a free-form string from the data).

**Step 3 — Per segment**
```
ratios      = [ quota / pipeline_value  for each rep in segment ]   (fairness ratio)
median_ratio = median(ratios)
quota_cv    = std(quotas) / mean(quotas)          (coefficient of variation)
is_paintbrushed = quota_cv < config.segment.paintbrush_cv_threshold
```
`quota_cv ≈ 0` means everyone in the segment got a near-identical quota → "paintbrushed".

**Step 4 — Per rep (fairness band)**
```
ratio      = quota / pipeline_value
deviation  = (ratio − segment_median_ratio) / segment_median_ratio     (signed, relative)
band       = first fairness_band whose max_deviation ≥ deviation
             (Underloaded → Equitable → Stretched → Overloaded, thresholds from config)
color      = that band's color (from config)
```
Each rep becomes a **heatmap cell** (`rep_id, segment, region, band, deviation, color`) and a
**fairness result** (adds `fairness_ratio, segment_median_ratio`).

**Step 5 — Findings** (severity-ranked): `DEPLOYED_GT_TARGET` (if over>0), `PAINTBRUSH_SEGMENT`
(per paintbrushed segment), `REP_OVERLOADED` (per rep in the Overloaded band).

**Step 6 — Assumptions** (always attached, derived from config + live data source, not hardcoded).

### → How it shows on the Territory Equity dashboard
| On screen | Comes from |
|---|---|
| Metric tiles (Company Target, Deployed Quota +% over, Reps, Fairness Flags) | `top_down_target`, `deployed_quota`, `over_pct`, `rep_count`, count of reps with band≠Equitable |
| Callout banner ("deployed exceeds target by X%") | `over_pct`, `deployed_quota`, `top_down_target` |
| Fairness heatmap (segment × region) | avg `fairness_ratio` of the reps in each (segment, region) cell — computed from `per_rep` |
| Fairness distribution bars | count of `heatmap` cells per band |
| Per-segment CV + PAINTBRUSH tag | `segments[].quota_cv`, `is_paintbrushed` |
| Fairness outliers table | `per_rep` sorted by |deviation| |

---

## B. Capacity Headroom engine  (`domain/engine/capacity.py`)

Answers: *who is over/under-loaded, and how much more can the team carry?*

**Step 1 — Baseline per segment** = mean quota of that segment (data-driven, no fixed number):
```
baseline[segment] = mean(quota of reps in segment)
```

**Step 2 — Per rep**
```
load_index = quota / baseline[segment]
class      = Overloaded   if load_index ≥ config.capacity.over_threshold
             Underloaded  if load_index ≤ config.capacity.under_threshold
             Balanced     otherwise
ceiling    = baseline × config.capacity.max_stretch      (sustainable ceiling)
headroom   = max(0, ceiling − quota)                     (room to take more)
```

**Step 3 — Team totals**
```
team_total_quota          = Σ quota
team_additional_capacity  = Σ headroom
team_additional_pct       = team_additional_capacity / team_total_quota × 100
overloaded / balanced / underloaded = counts by class
```

**Step 4 — Segment rollups**: per segment → rep_count, mean_quota (baseline), total_headroom,
over/balanced/under counts.

**Step 5 — Redistribution** (greedy, within a segment): move quota from reps above the ceiling to
reps with headroom → a list of `{from_rep, to_rep, amount}` moves.

**Step 6 — What-if scenarios** (parsed from the question, deterministic):
```
cut N     : drop the N lowest-loaded reps → recompute → capacity change
add N     : added_capacity = avg_baseline × max_stretch × N   (optionally in a region)
headroom  : just report team_additional_capacity
```

### → How it shows on the Capacity Overview dashboard
| On screen | Comes from |
|---|---|
| Metric tiles (Balanced, Over-loaded, Under-loaded, Additional Headroom) | counts + `team_additional_capacity` |
| Per-rep opportunity-load bars (width & %, red/green/amber) | `per_rep.load_index` (×100 for %), `classification`/`color`; 100% reference line |
| Segment rollups table | `rollups` |
| Redistribution suggestions table | `redistribution` |
| What-if card (before → after, feasible) | `scenario` |

---

## C. Determinism hash

`stats.determinism_hash(payload)` = SHA-256 over the canonical JSON of the computed output
(Decimal-quantized, keys sorted) **+ config version + snapshot id**. Same data + same config →
identical hash → *same question, same answer*. Recorded in `audit_inference` every run.

---

## D. Where each dashboard's data comes from (all DB, none static)

```
reps table + client_config (DB)
        │
        ▼
   engine.compute()  ── pure Python, deterministic
        │  (report: deployed/target/segments/per_rep/heatmap/findings … or
        │            team capacity/per_rep loads/rollups/redistribution/scenario)
        ▼
 GET /dashboards/{territory-equity, capacity-overview, executive-summary}?role=…
        │  (server-cached by role + config version + data revision)
        ▼
   dashboard pages render tiles / heatmap / bars / tables straight from the report
```

- **No dashboard value is static or hardcoded** — every figure is a field of the computed report,
  which is computed from the DB rows + DB config.
- **Swap the database** → the engine recomputes → every tile, chart, and table updates. No code
  change.
- **Edit a config lever** (target, thresholds, bands) on the Configuration page → the report
  recomputes on the next load (cache keyed by config version).

---

## E. Audit — confirmed no hardcoded business values

| Value | Source (not hardcoded) |
|---|---|
| Top-down target | `config.company.top_down_target` |
| Paintbrush threshold | `config.segment_definitions[].paintbrush_cv_threshold` |
| Fairness band cutoffs + colors | `config.fairness_bands` |
| Capacity over/under thresholds, max stretch | `config.capacity.*` |
| Segment baseline | computed = mean quota of the segment (from data) |
| Segments / regions | free-form strings from the rep rows (no enum) |
| Deployed quota, ratios, CV, load, headroom | computed from the rep rows |

The only literals in the engine are formatting helpers (`$…M` display, a grey fallback color) —
never a business number.

---

## The exact prompts we send (verbatim)

These are the real prompts, not paraphrases. Every prompt **forbids the model from producing
numbers** — the model only routes or explains.

### 1. Intent classifier  (Step 2 · model: Claude Haiku · returns JSON)
Sent with the user's question (+ the last few turns for follow-ups):
```
You are the intent router for Voiant Sales Planning Intelligence. Read the user's question and
decide which specialist should answer it. Reason about MEANING, not keywords — paraphrases,
typos, and follow-ups should still route correctly.

The specialists:
• quota_equity — quota FAIRNESS: is quota spread fairly, is a segment 'paintbrushed' (everyone
  given the same number), is deployed quota over the top-down target, which reps are over/under-
  assigned relative to their opportunity.
• capacity_headroom — team CAPACITY & LOAD: who is overloaded or underloaded, how much more quota
  the team can carry, effects of hiring/cutting reps or redistributing load.
• synthesis — use ONLY when the question genuinely needs BOTH lenses at once (e.g. 'overall
  health', 'give me the big picture', 'rebalance the whole team').

If the question is a vague follow-up ('what about the west?', 'and now?'), use the recent-
conversation context to stay on the previous specialist.

Respond with ONLY a JSON object, no prose:
{"agent": "quota_equity | capacity_headroom | synthesis", "confidence": <0.0-1.0>, "reason": "<one short sentence, plain English>"}
```

### 2. Quota Equity narrative  (Step 7 · model explains the computed fairness numbers)
Sent with the aggregates-only JSON payload:
```
You are a senior sales-planning analyst presenting to a CRO or Sales Ops leader for Voiant Sales
Planning Intelligence.

You are given COMPUTED figures as JSON (the analysis is already done by a deterministic engine).
The JSON includes a `user_question` — directly answer that specific question first, using only the
computed figures, then add the most relevant supporting context.

Hard rules:
- Do NOT compute, infer, round, or invent ANY number. Cite only values present in the input JSON.
  If a number is not in the input, do not state it.
- Lead with the single most important finding (usually deployed-vs-target or a paintbrushed segment).
- Explain *why* each flag was raised, in business terms.
- Be concise: 3–6 short paragraphs. No preamble, no sign-off.
- End with a short "Assumptions to confirm" list drawn from the input's assumptions.

Tone: confident, specific, executive-ready. This goes straight into a client demo.
```

### 3. Capacity Headroom narrative  (Step 7 · capacity questions & what-ifs)
```
You are a senior sales-planning analyst presenting to a CRO or Sales Ops leader for Voiant Sales
Planning Intelligence.

You are given COMPUTED capacity figures as JSON (a deterministic engine already did the analysis).
The JSON includes a `user_question` — directly answer that specific question first, using only the
computed figures, then add the most relevant supporting context.

Hard rules:
- Do NOT compute, infer, round, or invent ANY number. Cite only values present in the input JSON.
- Lead with how much more quota the team can carry, then load distribution (over / balanced /
  under-loaded), then redistribution opportunities.
- If a `scenario` is present, explain its outcome (before → after) in business terms.
- Headcount scenarios are ADVISORY ONLY — never name or imply specific terminations.
- Be concise: 3–5 short paragraphs. End with a short "Assumptions to confirm" list.

Tone: confident, specific, executive-ready.
```

### 4. Scenario Orchestrator synthesis  (Step 7 · when a question spans both agents)
Sent with both agents' computed outputs:
```
You are the Scenario Orchestrator for Voiant Sales Planning Intelligence. You are given the
computed outputs of multiple agents as JSON. Synthesize ONE coherent, executive-ready answer that
connects quota fairness and capacity. Do NOT invent numbers — cite only values present in the
input. 3–5 short paragraphs.
```

> The prompts are stored as editable files (`backend/config/prompts/*.md`) with in-code fallbacks,
> so they can be tuned without a code change. The live prompt for any run is also shown verbatim in
> the UI under **Technical details → Model → System prompt / Input**.

