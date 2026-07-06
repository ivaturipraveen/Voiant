# Voiant — Technical Flow: from question to answer

This document traces **exactly** what happens on every request, step by step: how the
question is classified, how data is retrieved, how it is parsed, what is computed, how the
payload is assembled, and how it is sent to the model. File/function references are given so
each step is verifiable in the code.

> **Core principle.** A **deterministic Python engine computes every number and finding.**
> The AI (Claude) does only two things: (1) understand the question, and (2) explain the
> already-computed numbers in plain English. The model never computes, filters, or invents a
> figure. This is what makes the system auditable and guarantees *same question → same answer*.

---

## The flow at a glance

Only two steps are AI — *understand* the question and *explain* the answer. Everything that
touches a number is deterministic.

```mermaid
flowchart TD
    B["0 · Data loaded once at boot"] --> Q["1 · Question received"]
    Q --> C["2 · Classify (AI) — pick the agent by meaning"]
    C --> P["3 · Parse input — extract params (n, region)"]
    P --> R["4 · Shielded read — PII per role, every read logged"]
    R --> E["5 · Compute (engine) — all numbers + findings + hash"]
    E --> A["6 · Assemble payload — aggregates only, 0 rows, 0 PII"]
    A --> M["7 · Model explains (AI) — narrate, never compute"]
    M --> D["8 · Audit and respond — charts from the real report"]
```

Throughout the steps below, we follow one concrete example:

> **Question:** *"What if we add 5 heads in the West region?"* · **Role:** admin

```mermaid
flowchart LR
    q["'add 5 heads in West'"] --> c["Capacity Headroom · 95%"]
    c --> p["add_heads · n=5 · region=West"]
    p --> e["headroom $26.6M → +5: $38.5M"]
    e --> a["1,872 bytes · 0 rows · 0 PII"]
    a --> m["claude-opus-4-8 → answer"]
```

---

## Step 0 — Data is loaded ONCE at boot (not per question)

Before any question is asked, the dataset is loaded and masked a single time at startup.

- `app/runtime.py` → `bootstrap()` dispatches on `VOIANT_DATA_SOURCE`:
  - `database` → `_load_database()` runs `SELECT … FROM reps` (SQLAlchemy) against `VOIANT_DATABASE_URL`.
  - `csv` / `synthetic` are the other sources.
- Each record's **PII fields** (`display_name`, `email`) are sent to the Bright Masker
  (`app/shield/masking.py` → `POST /mask`) and replaced with **stable tokens** like
  `[PERSON 6]`, `[EMAIL 3]`. The token↔value mapping is stored in the **`shield_map`** vault.
- The result is an **in-memory masked snapshot** (`DatasetSnapshot.masked_reps`) — the working
  set for the whole session.

**Consequence:** every question runs against this in-memory snapshot. **We do not run a new
database query per question.** (Surfaced in the trace as *"loaded from the reps table … masked
ONCE at boot"*.)

---

## Step 1 — Question received

- **Endpoint:** `POST /agents/chat` — `app/api/routers/agents.py`
- **Body:** `{ question, role, session_id, allow_llm }` (`app/schemas/api.py::ChatRequest`)
- Handed to `app/services/analysis_service.py::run_agent(rt, question, role, session_id, allow_llm)`.
- **Session:** `rt.ensure_session()` creates/looks up an in-memory session; `rt.last_agent()` and
  `rt.session_memory()` provide conversation context for follow-ups. *(Memory is in-RAM only,
  never persisted.)*

Example input: `{ question: "What if we add 5 heads in the West region?", role: "admin" }`

---

## Step 2 — Semantic classification (AI #1)

- **Where:** `app/agents/orchestrator.py::plan(question, llm, last_agent, history)`
- A **small, fast model — Claude Haiku** (`claude-haiku-4-5`, configurable via
  `voiant_model_classifier`) — reads the *meaning* of the question and returns strict JSON:
  `{ "agent": …, "confidence": 0-1, "reason": "…" }` (`app/llm/client.py::classify`,
  prompt in `app/llm/prompts.py::classifier_prompt`).
- **No keyword matching.** Paraphrases, typos, and vague follow-ups all route correctly; the
  last 3 turns are passed in so *"what about the west?"* stays on the previous agent.
- **Fallback (model offline):** stay on the last agent, else default to `quota_equity`. There is
  no keyword guessing.
- Agents available: `quota_equity`, `capacity_headroom` (and `synthesis` when both are needed).

Example result: `agent = capacity_headroom`, `confidence = 0.95`,
`reason = "Adding headcount is fundamentally a capacity and load question."`

---

## Step 3 — Input parsing (deterministic — NOT the model)

For the capacity agent, any **what-if scenario** parameters are extracted from the raw text.

- **Where:** `app/agents/capacity_headroom_agent.py::_detect_scenario(question, reps, config)`
- **How:**
  - Number `n` via the digit pattern `\b(\d+)\b`.
  - `region` matched against the known `Region` enum values.
  - Intent via trigger words: `add/hire/headcount` → **add_heads**, `cut/reduce/remove` →
    **cut_heads**, `how much more/carry/absorb/headroom` → **headroom_query**, else **base_analysis**.
- Returns `(scenario_outcome, parse_detail)`; `parse_detail` is surfaced in the trace's
  **"Input parsing"** section so the extraction is fully visible.

Example: intent = `add_heads`, params = `{ n: 5, region: "West" }`.
*(The quota agent has no parameters to parse — it always runs a full fairness analysis.)*

---

## Step 4 — Shielded read (RBAC + lineage)

- **Where:** `app/agents/_reps.py::build_reps(ctx, agent_name)`
- Each rep is rebuilt from the masked snapshot. The PII fields are **re-hydrated per role** via
  `app/shield/masking.py::demask_value` reading the `shield_map` vault:
  - **admin** → full values (`[PERSON 6]` → `Liam Rossi`)
  - **analyst** → initials (`L. R.`)
  - **viewer** → stays fully redacted (token kept)
- **Every field read is logged** to the **`lineage`** table (who/which agent read which field,
  when, masked or not). The masking policy per role lives in the DB-backed client config
  (`client_config` table → `rbac_roles`, seeded from `config/client_rapid7.yaml`).

Example (admin): 80 reps rehydrated to full names; 160 field reads (name + email × 80) logged.

---

## Step 5 — Deterministic engine (the math — no AI)

- **Where:** `app/domain/engine/capacity.py::compute(reps, config, data_source)` (and
  `quota_equity.py::compute` for the fairness agent). These modules are **pure**: no IO, no LLM,
  no clock.
- The engine reads only the analytical fields — `quota, pipeline_value, segment, region,
  attainment` — over **all reps**, and computes:
  - **Capacity:** each rep's `load_index = quota ÷ segment-mean-quota`; classifies Over/Balanced/
    Under against `capacity.over_threshold` / `under_threshold` (from config); sums **team
    additional capacity** (headroom to `max_stretch`); rolls up per segment; derives redistribution
    moves.
  - **Quota equity:** deployed vs `company.top_down_target`; per-rep fairness ratio vs segment
    median → band; per-segment coefficient-of-variation → **paintbrush** flag.
- **What-if overlay:** `_detect_scenario` (step 3) calls `simulate_add / simulate_cut /
  headroom_query`, attaching a `ScenarioOutcome` with `before` / `after`.
- **Determinism hash:** SHA-256 over the canonical, Decimal-quantized output + config version +
  snapshot id (`app/domain/engine/stats.py::determinism_hash`). Same inputs → identical hash.
- **Assumptions** are always attached, and are **derived, not hardcoded** — the data-provenance
  assumption reflects the live `VOIANT_DATA_SOURCE` and `config.company.name`
  (`app/domain/engine/provenance.py`).

Example output: team additional capacity **$26.57M**, overloaded **8**, balanced **60**,
underloaded **12**; scenario `add_heads` → before 80 reps/$26.6M, **after 85 reps/$38.5M**,
feasible `true`.

**Audit:** before any narration, `ctx.recorder.record_inference(...)` writes the run (hash,
config version, finding count) to **`audit_inference`**.

---

## Step 6 — Payload assembly (what actually goes to the model)

- **Where:** `capacity_headroom_agent.py::_payload(report)` (+ `user_question` appended).
- The engine's full report is **projected down** to a compact JSON summary: team totals,
  per-segment rollups, findings, the scenario, assumptions, and the user's question.
- **Zero raw rep rows and zero PII** are included — only computed aggregates.
- Serialized with `json.dumps` → this exact string is what the model receives (shown verbatim in
  the trace under *"Input SENT to the model"*).

Example: a **~1,872-byte** JSON object. Raw rep rows sent: **0**. PII sent: **false**.

---

## Step 7 — Model explains (AI #2)

- **Where:** `capacity_headroom_agent.py::_narrate` → `app/llm/client.py::narrate`.
- **Model routing:** `claude-opus-4-8` for complex reasoning / what-if scenarios, `claude-sonnet-4-6`
  for standard narratives (`config → model_routing`).
- The **system prompt explicitly forbids computing or inventing numbers** — the model may only
  cite values present in the JSON payload (`app/llm/prompts.py`).
- If the model is unavailable, a **deterministic template narrative** is produced from the same
  numbers (byte-stable), so an answer is always returned.
- The call is logged to **`audit_llm`** (model, whether it fell back).

Result: a plain-English explanation of the computed figures — no new numbers introduced.

---

## Step 8 — Response & render

- **Where:** `analysis_service.run_agent` returns `AgentRunResponse` (`app/schemas/api.py`):
  `report` (all computed numbers), `narrative`, `determinism_hash`, `suggested_followups`,
  `memory`, and the full `trace`.
- The frontend renders **charts directly from `report`** (heatmap, load bars, rollups) —
  `frontend/src/components/{Heatmap,QuotaEquityView,CapacityView}.tsx`. **No chart uses hardcoded
  data**; every value binds to a `report` field.
- The **technical trace** (`InspectPanel.tsx`) — opened with **🔍 Technical details** under any
  answer — replays all of the above, step by step:
  - **Routing** — chosen agent, classifier model, confidence, and the model's reason.
  - **Input parsing** — the what-if parameters pulled from the text (e.g. `n=5, region=West`).
  - **Secure read through Shield** — your role, what you can see, and now the **PII columns taken
    from the client config** (`pii_fields`, *declared per company — not hardcoded*), plus a note
    that declared columns are tokenised **locally in one batched write** (scales to tens of
    thousands of reps). A 5-row sample shows token → re-hydrated value for your role.
  - **Engine** numbers + determinism hash, **findings**, **segment breakdown** (segments are
    free-form, straight from the data), **assumptions**.
  - **Data retrieval & payload** — column-selective + capped `SELECT`, 0 raw rows / 0 PII to the
    model, final payload size.
  - **Model** — the exact system prompt, JSON input, and returned narrative.
  - **Session memory** — the remembered turns.

  So every recent change is visible in the trace: semantic routing (no keywords), config-driven
  PII, local batched masking, and data-independent segments/regions.

---

## Deep dive: one query, end to end — with masking timing

This traces a single question in full detail, including **exactly when data is read from the
database, when PII is masked, and when it is un-masked**. A key point up front:

> **The database is read once, at boot — not per question.** And **PII never travels to the
> model.** Masking happens at *ingest*; un-masking happens at *read time* for display (per role).
> The model round-trip carries only computed numbers, so there is nothing to "un-mask" in the
> model's response.

**Query for this walk-through:** *"Is each rep's quota fair given their territory's opportunity?"*
· **Role:** `analyst`

### Phase A — Boot (once): read the DB and mask PII into a vault

1. **Read the database.** `runtime.py::_load_database()` runs the configured query — selecting
   only the columns the app uses (not `SELECT *`) and capped by `VOIANT_MAX_REPS`:
   ```sql
   SELECT rep_id, display_name, email, segment, region, quota, pipeline_value, … FROM reps LIMIT …;
   ```
   It returns raw rows — **with real PII**:
   ```json
   { "rep_id": "R000", "display_name": "Liam Rossi", "email": "liam.rossi@acme.com",
     "segment": "Enterprise", "region": "West", "quota": 2400000, "pipeline_value": 7000000, ... }
   ```

2. **Mask the PII columns (config-driven, batched).** The PII columns + their token labels come
   from the client config (`pii_fields`, e.g. `display_name→PERSON`, `email→EMAIL`) — not
   hardcoded. Because these are *declared* PII columns, the whole value is tokenised **locally in
   one batched vault write** (no per-value network call), so ingest scales to tens of thousands of
   reps. The mapping is recorded in the **`shield_map` vault**:
   | Real value | Token (stored) | Vault row |
   |---|---|---|
   | `Liam Rossi` | `[PERSON 6]` | `shield_map: [PERSON 6] ↔ Liam Rossi` |
   | `liam.rossi@acme.com` | `[EMAIL 3]` | `shield_map: [EMAIL 3] ↔ liam.rossi@acme.com` |
   *(The Bright Masker detector is reserved for free-text fields with unknown PII.)*

3. **Keep only the masked row in memory.** The working snapshot holds tokens, never raw PII:
   ```json
   { "rep_id": "R000", "display_name": "[PERSON 6]", "email": "[EMAIL 3]",
     "segment": "Enterprise", "region": "West", "quota": 2400000, "pipeline_value": 7000000, ... }
   ```
   The only place the real values still exist is the reversible vault. *(This is what the Shield
   toggle flips: with Shield **off**, step 2 is skipped and the raw values are kept as-is.)*

> ⏱️ **Masking happens here — once, at boot.** No question has been asked yet.

### Phase B — Per question (fast): read the snapshot, un-mask for the role

4. **Question arrives** → classified to `quota_equity` (see steps 1–2 above). **No database query
   runs** — everything below reads the in-memory masked snapshot.

5. **Un-mask (re-hydrate) for the role.** `_reps.py::build_reps` rebuilds each rep and calls
   `masking.py::demask_value` on the display fields. Two things happen, in order:
   - **Re-hydrate the token:** `[PERSON 6]` → look up the vault → `Liam Rossi`.
   - **Apply the role's display mask** (`rbac_roles` in the config):
     | Role | `demask_value("[PERSON 6]")` → |
     |---|---|
     | admin | `Liam Rossi` (full) |
     | **analyst** | `L. R.` (initials) ← *this run* |
     | viewer | `[PERSON 6]` (kept redacted) |
   - Every read writes a **lineage** row (`agent, field, role, masking level, time`).

   So the analyst’s in-memory rep is `{ rep_id: "R000", display_name: "L. R.", … }`.

> ⏱️ **Un-masking happens here — at read time, per role.** Not after the model; *before* the engine,
> and only for display fields. The numeric fields (`quota`, `pipeline_value`) were never masked.

### Phase C — Compute, convert, and send to the model

6. **Compute.** `engine/quota_equity.py::compute` runs on the reps and produces the report — deployed
   vs target, per-segment CV / paintbrush, per-rep fairness bands, findings, a determinism hash.
   The math uses only `quota` and `pipeline_value`; names/emails are irrelevant to it.

7. **Convert to the model payload.** The report is projected to a compact JSON of **aggregates only**
   and the question is appended. Crucially, **no rep names, emails, tokens, or raw rows are in it**:
   ```json
   { "deployed_quota": "166000000.06", "top_down_target": "130000000",
     "over_assignment_pct": 27.69,
     "segments": [ { "segment": "Enterprise", "quota_cv": 0.18, "is_paintbrushed": false }, … ],
     "findings": [ { "code": "DEPLOYED_GT_TARGET", "severity": "critical", "message": "…" }, … ],
     "user_question": "Is each rep's quota fair given their territory's opportunity?" }
   ```

8. **Send to the model.** Claude receives that JSON with a system prompt that says *explain, never
   compute*. It returns a plain-English narrative over those numbers.

### Phase D — Response: there is nothing to un-mask

9. The model’s answer is prose about the computed figures. **It never received any PII or any token,
   so there is nothing to un-mask on the way back.** The response, the report (already role-masked in
   step 5), and the trace are returned; the UI renders the charts from the report.

### The masking timeline, in one line

```
BOOT:      DB read → mask PII → tokens in vault + masked snapshot        (once)
PER QUERY: read masked snapshot → re-hydrate + role-mask for display     (fast, no DB)
           → engine computes on numbers → aggregates-only JSON → model
RESPONSE:  model explains the numbers → nothing to un-mask (it saw no PII)
```

**Why this matters:** the model is never a place where PII could leak, because PII is removed at
ingest and the model is only ever handed computed numbers. Un-masking is a *display* concern, gated
by role at read time, and fully logged.

---

## Design decision: why "engine computes" beats "mask → model → unmask"

A reasonable alternative pattern is: on each query, **fetch the rows → mask the PII → send the
masked rows to the model → let the model reason → un-mask the model's output → show it.** That is a
legitimate production pattern (it's what classic "PII-safe chat" does). We deliberately chose a
different one. Here is the comparison and why.

| | Mask → model → unmask | **Engine computes → aggregates only** (this system) |
|---|---|---|
| What the model receives | Masked **rows** (tokens + real quotas) | Only **computed aggregates** — no rows, no tokens, no PII |
| Who does the math | The **model** (can vary / hallucinate) | A **deterministic engine** (exact, hash-verified) |
| Same question → same answer | Not guaranteed | Guaranteed |
| Un-mask step needed | Yes (tokens come back in the output) | No (output never contained tokens) |
| Cost / tokens per query | High (N rows every time) | Low (a small summary) |
| CISO claim | "we masked the PII we sent" | "**we sent no rows and no PII at all**" |

**Why the swappable database makes this the clear winner.** Because the dataset can change at any
time (point `VOIANT_DATABASE_URL` at a new DB, or switch `VOIANT_DATA_SOURCE` to csv/synthetic):

- **One env var, no code change.** On boot the new source is read, masked, and the engine recomputes
  — numbers, provenance text, and assumptions all adapt automatically.
- **Source-agnostic security.** The same masking runs for Postgres, CSV, or synthetic, so switching
  databases never changes what leaves for the model (still: nothing but aggregates).
- **No per-DB re-audit.** The contract with the model is fixed regardless of the database, so you
  never have to re-verify "what did we send this time".
- **Deterministic on any dataset.** A new DB yields new numbers, still reproducible and hash-verified
  — whereas letting the model do the math would make results drift per run *and* per database.

**When the other pattern is right.** If a user asks something the engine does **not** pre-compute —
open-ended Q&A over raw records, summarising free-text notes with names — then mask → model → unmask
is the correct tool: mask the rows, let the model reason, un-mask the response. The recommended
end-state is a **hybrid**: the deterministic engine for structured analytics (fairness, capacity,
what-ifs), and a masked-LLM "free-form ask" mode for open questions — never sending raw PII in either.

**Verdict:** for reproducible, auditable sales-planning numbers over a database you can swap at will,
**engine-computes / aggregates-only is the best approach** — it is both safer (no PII or rows reach
the model) and more robust to data changes (swap the DB freely; the model contract is unchanged).

---

## Governance & determinism (why a client can trust it)

| Guarantee | How it's enforced |
|---|---|
| Same question → same numbers | Determinism hash over Decimal-quantized engine output |
| Model can't invent figures | Engine computes everything; prompt forbids computation; numbers validated against payload |
| No PII leaves for the model | Only aggregates sent; 0 raw rows; PII replaced by Shield tokens at ingest |
| Full auditability | `lineage` (field reads), `audit_inference` (runs), `audit_llm` (model calls) |
| Reproducible config | Client rules in `client_rapid7.yaml`; runs pin a config version |
| No hardcoding | Targets/thresholds/bands live in config; provenance derived from the live data source |

## Data model (Postgres tables)

| Table | Holds |
|---|---|
| `reps` | The sales reps (source dataset) |
| `shield_map` | Token ↔ real-value vault (e.g. `[PERSON 6]` ↔ `Liam Rossi`) |
| `shield_counter` | Keeps token numbering stable/consistent |
| `lineage` | Every field read: who/which agent/when/masked |
| `audit_inference` | One row per agent run (question, hash, config version) |
| `audit_llm` | One row per model call (prompt/response metadata) |

---

## End-to-end example (all steps together)

**"What if we add 5 heads in the West region?"** (admin)

1. **Received** → `/agents/chat`.
2. **Classified** → Haiku → `capacity_headroom`, 95% ("headcount = capacity question").
3. **Parsed** → `add_heads`, `{ n: 5, region: West }` (regex + keyword, deterministic).
4. **Shielded read** → 80 reps re-hydrated for admin; 160 reads logged to `lineage`.
5. **Computed** → team headroom $26.57M; 8 over / 60 balanced / 12 under; scenario
   before 80 reps/$26.6M → after 85 reps/$38.5M; determinism hash emitted; run → `audit_inference`.
6. **Payload** → ~1,872-byte JSON (aggregates + findings + scenario + question); 0 rows, 0 PII.
7. **Model** → `claude-opus-4-8` explains the numbers; call → `audit_llm`.
8. **Response** → report + narrative + trace returned; capacity bars + rollups render from `report`.

Every number the client sees was computed in step 5; the model only wrote the sentences in step 7.
