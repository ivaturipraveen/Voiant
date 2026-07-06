# Voiant Sales Planning Intelligence — Project Overview

> A single reference for what this project is, what we've built, what data we use, and
> what changes later. Distilled from `Voiant_Brightcone_POC_Scope - V1.docx` and
> `Voiant Intelligence - Brightcone Architecture.pdf`.

---

## Plain-English guide — who builds, buys, and uses this (start here)

Think of the project in terms of **who owns the product, who builds it, who buys it, and**  
**who actually uses it.**

### The two companies

- **Brightcone — owns the technology (the engineering company).** Builds the AI platform,
backend, security (Shield), AI orchestration, data ingestion, connectors, UI, and agents.
- **Voiant — the business company.** Provides sales-planning expertise, industry knowledge,
customers, sales, and branding.

### Hassan (Voiant President)

His job is **not coding** — it's showing demos, talking to customers, and closing deals.

```
Engineering Team → builds the platform → Hassan → shows demo → Customer → buys
```

### The customers

First targets: **Rapid7, Tanium, other Pigment customers.** They don't build the software —
they evaluate whether to buy it.

### Who the demo is shown to (and what they ask)

Leadership inside the customer org — **CRO, Sales Ops, RevOps, CFO** — who ask business
questions the AI answers: *Are our quotas fair? Which reps are overloaded? Should we hire more
reps? What if we cut five reps?*

### Key terms

- **Rep = Sales Representative (a salesperson).** The platform analyzes every rep.
- **Quota = a rep's sales target** (e.g. John's quota = $2,000,000). The AI checks whether each
quota is reasonable.
- **Deployed quota** = the sum of all rep quotas ($166M). **Top-down target** = the company
goal ($130M). They are different numbers — the platform never conflates them.

### Who interacts with whom

```
DEVELOPMENT          Brightcone engineers build the platform;
                     Voiant gives the business rules.

SALES                Customer → Hassan (Voiant) demonstrates the platform.

DAILY USE (post-sale)  Sales Ops / CRO / CFO → use the platform directly.
                       No engineers involved in normal usage.
```

### The three end-user personas


| Persona               | Cadence | Typical questions                                                               |
| --------------------- | ------- | ------------------------------------------------------------------------------- |
| **Sales Ops Planner** | Daily   | Move accounts, balance quotas, find overloaded reps, run scenarios              |
| **CRO**               | Weekly  | Is everyone's quota fair? Which teams are struggling? What do I show the board? |
| **CFO**               | Monthly | How much commission will we pay? What are comp expenses? Are we over budget?    |


### What is the Scenario Orchestrator?

The **manager** of all the AI agents. When a user asks *"If I hire 10 reps, what happens?"* it
decides which agents (Capacity Headroom, Quota Equity, …) should work together and combines
their results into one answer.

### What is an Agent?

An AI module that performs one specific business task:


| Agent                  | Responsibility                        | In this build |
| ---------------------- | ------------------------------------- | ------------- |
| Quota Equity           | Checks whether quotas are fair        | ✅ Built       |
| Capacity Headroom      | Whether reps can handle more quota    | ✅ Built       |
| Scenario Orchestrator  | Routes questions and combines answers | ✅ Built       |
| Territory Intelligence | Territories and account coverage      | ❌ Phase 1     |
| Pipeline Hygiene       | CRM pipeline quality                  | ❌ Phase 1     |
| Comp Expense           | Compensation costs                    | ❌ Phase 2     |


### How a question flows through the system

The user enters through **any interface** (chat or a dashboard). The **Scenario Orchestrator**
reads the intent and sends it to the **right agent** — or runs **several and merges them**. The
chosen agent computes the numbers deterministically, and Claude writes the explanation.

```
  INTERFACE (5 tabs)              ORCHESTRATOR              AGENTS (pick the right one)
  ──────────────────              ────────────              ───────────────────────────
  Conversational  ─┐                                    ┌─► Quota Equity      ("is it fair?")
  Territory Equity ─┤                                    ├─► Capacity Headroom ("can we carry more?")
  Capacity Overview─┼─►  "Is John's quota fair?"  ─► routes ─┤
  Executive Summary─┤        (or a dashboard auto-asks)  ├─► (future: Territory, Pipeline, Comp)
  Behind the Scenes─┘                                    └─► or BOTH → synthesized answer
                                                                │
                          reads data (Shield-masked) → ENGINE computes numbers (deterministic)
                                                                │
                                              Claude explains the numbers (never invents them)
                                                                ▼
                              ONE answer: charts + reasoning + "assumptions to confirm"
```

**Key idea:** the **five tabs are just different doors into the same brain.** Chat lets you ask
anything; each dashboard is a fixed door that auto-asks one question and lays the answer out.
Same agents, same data, same numbers underneath.

### Whole-system picture

```
Customer company
   └─ Sales Ops / CRO / CFO
        └─ Chat or Dashboard
             └─ Scenario Orchestrator
                  ├─► Quota Equity Agent          ✅ built
                  ├─► Capacity Headroom Agent      ✅ built
                  ├─► Territory Intelligence       ❌ Phase 1
                  ├─► Pipeline Hygiene             ❌ Phase 1
                  └─► Comp Expense                 ❌ Phase 2
                        └─ Brightcone Platform
                             └─ Data + Shield + Audit
                                  └─ Charts + Reasoning → User
```

### In one breath

- **Brightcone** builds and owns the technology.
- **Voiant** provides sales expertise, customers, and sells the solution.
- **Hassan** demonstrates the POC and closes deals.
- **Customers** (Rapid7, Tanium) evaluate and potentially buy.
- **Reps** are the salespeople whose quotas, performance, and territories get analyzed.
- **Sales Ops, CROs, CFOs** are the end users, via chat or dashboards.
- **The Scenario Orchestrator** takes a question, invokes the right agents, and returns a
unified answer with charts and explanations.

---

## 1. What the project is

**Voiant Sales Planning Intelligence** is an **agentic AI platform for sales planning
and revenue operations** (the EPM / SPM / RevOps space). Two companies build it together:

- **Brightcone** — platform & engineering (owns the platform IP: orchestration, Shield,
secure ingestion).
- **Voiant** — go-to-market: domain expertise, clients, brand, sales.

It answers the questions a CRO, Sales Ops leader, or CFO actually asks — *"is each rep's
quota fair?"*, *"how much more quota can the team carry?"*, *"what if we cut/add N reps?"* —
in plain language, with reasoning, charts, and a visible audit trail, over their planning data.

### Why it exists (the business goal)

This is a **4-week, sales-ready Proof of Concept** — not a prototype. It is the asset
Hassan (Voiant's President) demonstrates to **close the first three paying clients**
(Rapid7 first, then Tanium, then another Pigment customer). Every design choice serves
one test: *a CRO says "yes" after a 30-minute demo.*

Three objectives, in priority order:

1. **Win the first three paying clients.**
2. **Validate the platform-plus-agent model** (client config + shared agents + platform).
3. **Establish the Brightcone–Voiant operating rhythm.**

---

## 2. The architecture (3 layers)

```
┌─ CLIENT-SPECIFIC LAYER (per client, visible) ───────────────────────────────┐
│  Interpretation rules ledger · Segment definitions · Stage criteria · RBAC   │
│  e.g. "$130M target ≠ $166M deployed"                                         │
├─ AGENT LIBRARY (shared across all clients) ─────────────────────────────────┤
│  Six reasoning agents with declared handoffs (see §3)                        │
├─ BRIGHTCONE PLATFORM (invisible to client, owned by Brightcone) ────────────┤
│  Orchestration · Shield (governance/RBAC/audit/secure ingestion) ·           │
│  Connectors (Salesforce, Anaplan, Workday, NetSuite…) · Claude inference     │
└──────────────────────────────────────────────────────────────────────────────┘
```

The genius of the model: **agents are shared; only the thin client-config layer changes
per customer.** The next 30 clients look architecturally like the first 3. Buyers need to
*see* this config layer to believe the platform scales — so it's a visible UI panel.

---

## 3. The agent library — what each does & status


| Agent                      | What it does                                                                                                                                 | Status in our build                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Quota Equity**           | Quota fairness; deployed quota vs top-down target; paintbrush detection; per-rep fairness ratio; heatmap + reasoning                         | ✅ **Built**                               |
| **Capacity Headroom**      | Rep load scoring; under/balanced/over-loaded; how much more quota the team can carry; redistribution; two-sided bar chart; hire/cut what-ifs | ✅ **Built**                               |
| **Scenario Orchestrator**  | Routes questions to the right agent; keeps conversation context; synthesizes cross-agent answers; what-if ("cut N reps", "add N heads")      | ✅ **Built**                               |
| **Territory Intelligence** | Account moves, TAM, coverage                                                                                                                 | ❌ Phase 1 (funded by first signed client) |
| **Pipeline Hygiene**       | Stage validation, activity reads                                                                                                             | ❌ Phase 1 (needs CRM connector)           |
| **Comp Expense**           | Plan vs paid, accrual & risk (CFO buyer)                                                                                                     | ❌ Phase 2 (CFO expansion)                 |


---

## 4. Who uses it (3 personas)


| Persona               | Cadence | What they do                                              |
| --------------------- | ------- | --------------------------------------------------------- |
| **Sales Ops Planner** | Daily   | Multi-account moves, exception queue, on-demand scenarios |
| **CRO / Sales Exec**  | Weekly  | Conversational Q&A, executive summary, board prep         |
| **CFO / Controller**  | Monthly | Comp expense, accrual forecast, variance investigation    |


The product supports **two interaction modes**: conversational (chat) **and** pre-built
dashboards — because some buyers ask questions, others want numbers laid out.

---

## 5. The data — what we use (important)

**We use synthetic data only. No production/real client data is processed in the POC.**
This is an explicit assumption in the scope and what lets us demo safely to any buyer.

- **Shape:** ~80 reps across **5 segments** (Enterprise, Commercial, Mid-Market, SMB,
Strategic) and **4 regions** (North/South/East/West), with quota, attainment, OTE, OTC,
pipeline, and territory fields.
- **Deterministic:** generated from a fixed seed (`VOIANT_DATASET_SEED=42`), so it's
byte-identical every run — part of the "same question → same answer" guarantee.
- **Deliberately seeded with findings** the agents can discover:
  - a **paintbrushed segment** (Commercial — identical quota across reps regardless of
  opportunity),
  - **overloaded reps** (quota far above their pipeline),
  - the **deployed-vs-target gap**: total deployed quota ≈ **$166M** vs a **$130M** company
  target (the headline "$130M ≠ $166M" story).
- **Swappable for real data:** point `VOIANT_DATA_SOURCE=database` at a client's DB and it works
  as-is — segments/regions are free-form and PII columns are declared in config (no code changes).
- **Mock-data labeled** everywhere in the UI (the "MOCK DATA" badge), per output discipline.

**Real data path is also wired:** you can upload a **CSV/Excel** of reps; it runs through
the live **Bright Shield** PII pipeline (detect → mask → store mapping) on the way in. So
the platform proves it can ingest real data securely — we just don't *use* real data for
the demo.

### What we use for intelligence

- **Deterministic Python engine** computes every number and finding (auditable, repeatable).
- **Claude** (`claude-sonnet-4-6` default, `claude-opus-4-8` for complex reasoning) does
**only** intent-routing and plain-language narration over the already-computed numbers —
it never invents a figure. If no Claude key is set, a deterministic narrative renders the
identical facts.

### 5.1 · Data storage & tables (where data lives)

Data lives in a **PostgreSQL database** (Render) with a **SQLite fallback** for local dev — the
same schema and code run on both (via SQLAlchemy). The schema is owned by **Alembic**
migrations (`backend/migrations/`), applied automatically at startup. Client config is stored
in the DB (seeded from a YAML file on first boot).

| Store | Type | Holds | Location |
| --- | --- | --- | --- |
| **Reps** | **PostgreSQL** `reps` table | The rep dataset (source of truth; app reads it on boot) | Render Postgres |
| **Governance** | **PostgreSQL** tables | Shield token map, audit trail, data lineage, run logs | Render Postgres |
| **Client config** | **PostgreSQL** `client_config` table (one row per client) | Interpretation rules, segments, RBAC, thresholds, PII columns | Render Postgres (seeded from `backend/config/client_rapid7.yaml`) |
| **Working snapshot** | JSON (+ in-memory) | The masked dataset the app serves (cache of the DB) | `backend/data/snapshot.json` |

Switch data sources with `VOIANT_DATA_SOURCE` (`database` / `csv` / `synthetic`). Schema is
provisioned by Alembic at startup (`db.upgrade_to_head()`); seed the `reps` data with
`python scripts/init_db.py --reset`.

**The database has 7 tables:**

| Table | Purpose | Key columns |
| --- | --- | --- |
| `reps` | The source rep dataset (app reads it on boot) | `rep_id`, `display_name`, `email`, `segment`, `quota`, `pipeline_value`, … |
| `shield_map` | The reversible PII vault — maps each token to its original value | `token` (PK), `entity_type`, `original_value`, `field`, `source`, `created_at` |
| `shield_counter` | Per-entity counter so tokens are stable & numbered (`[PERSON 1]`, `[PERSON 2]`) | `entity_type` (PK), `n` |
| `lineage` | Every field read — which agent read which field, when, with what masking | `run_id`, `agent`, `field`, `principal_id`, `masking`, `ts` |
| `audit_inference` | Every analysis run — the determinism hash, config version, counts | `run_id`, `agent`, `determinism_hash`, `config_version`, `field_reads`, `mock_data`, `ts` |
| `audit_llm` | Every Claude call — model used and whether it fell back to deterministic | `run_id`, `purpose`, `model`, `fell_back`, `ts` |
| `client_config` | The client config — **one row per client, updated in place** (seeded from YAML on first boot) | `client_id`, `version`, `data` (JSON), `source`, `is_active`, `created_at` |

**The core data record (a "Rep") — logical model:**

```
Rep = { rep_id, display_name*, email*, segment, region, territory_id,
        quota, ote, otc, pipeline_value, attainment }
        (* PII — stored as tokens; re-hydrated per role at read time)
```

### The 7 tables — columns + one real example row each

**1. `reps`** — the source rep dataset (80 rows). The app reads this on boot.

| Column | rep_id | display_name | email | segment | region | territory_id | quota | ote | otc | pipeline_value | attainment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example | R000 | Liam Rossi | liam.rossi@rapid7-sample.com | Enterprise | West | T-ENT-000 | 2992970.48 | 1404352.76 | 702176.38 | 9899104.08 | 0.7323 |

*What each `reps` column means:*
- **rep_id** — unique ID for the rep · **display_name / email** — the rep's name & email (PII)
- **segment** — customer-size band they sell to (Enterprise…SMB) · **region** — geography · **territory_id** — their assigned territory
- **quota** — the rep's yearly sales target ($)
- **ote** — *On-Target Earnings*: the rep's **total pay** (base salary + commission) if they hit 100% of quota
- **otc** — *On-Target Commission*: just the **commission** part of that pay at 100% quota
- **pipeline_value** — the value of the rep's open deals (their "opportunity")
- **attainment** — how much of quota they've achieved so far (0.7323 = 73%)

**2. `shield_map`** — the reversible PII vault (token ↔ original). Populated when Bright Shield is active.

| Column | token | entity_type | original_value | field | source | created_at |
| --- | --- | --- | --- | --- | --- | --- |
| Example | `[PERSON 1]` | Person | *Liam Rossi* (encrypted at rest) | display_name | database | 2026-07-01T12:18:22Z |

**3. `shield_counter`** — keeps token numbering stable (`[PERSON 1]`, `[PERSON 2]`…).

| Column | entity_type | n |
| --- | --- | --- |
| Example | Person | 80 |

**4. `lineage`** — one row per field read (who read which field, when, with what masking).

| Column | run_id | agent | field | record_scope | principal_id | masking | ts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Example | 4d16790382c7 | quota_equity | display_name | R000 | demo-admin | none | 2026-07-01T12:40:11Z |

**5. `audit_inference`** — one row per analysis run (the reproducibility record).

| Column | run_id | agent | agent_version | determinism_hash | config_version | field_reads | mock_data | ts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example | 4d16790382c7 | quota_equity | 1.0.0 | 8e4c333374276e38… | 1 | 160 | false | 2026-07-01T12:40:11Z |

**6. `audit_llm`** — one row per Claude call (which model answered, or if it fell back).

| Column | run_id | purpose | model | fell_back | ts |
| --- | --- | --- | --- | --- | --- |
| Example | 4d16790382c7 | quota_equity_narrative | claude-opus-4-8 | false | 2026-07-01T12:40:11Z |

**7. `client_config`** — the client config: **one row per client, updated in place** (seeded from `config/client_rapid7.yaml` on first boot, edited live via the Configuration page). `version` bumps on each save for display; there is no version history.

| Column | client_id | version | data (JSON) | source | is_active | created_at |
| --- | --- | --- | --- | --- | --- | --- |
| Example | rapid7 | 2 | `{company, segment_definitions, rbac_roles, …}` | update | true | 2026-07-03T17:12:04Z |

> Every question mints a new `run_id`; the `lineage`, `audit_inference`, and `audit_llm` rows for
> that question all share it — so any answer can be fully reconstructed and audited.

**How the tables relate** (everything ties together by `run_id`, the ID of one analysis):

```
   shield_map ──(token)──► used when reading rep PII ──► lineage
   shield_counter ──(numbers the tokens)

   one analysis run  ──run_id──┬──► lineage           (which fields were read)
                               ├──► audit_inference   (the hash + config version)
                               └──► audit_llm          (which Claude model answered)
```

> **Why this design:** SQLite + files means zero infrastructure to run the demo, yet the audit /
> lineage / token-vault are real, queryable, and durable. For production (Phase 1), these same
> tables move to Postgres — the schema is unchanged, only the connection swaps.

---

## 6. Governance & trust (built in from day one)

- **Shield two-tier secure ingestion** — Bright Shield detects PII; sensitive fields are
replaced with stable tokens (`[PERSON 1]`); the reversible mapping is stored; authorized
reads re-hydrate under **field-level RBAC** (admin = full, analyst = initials/domain,
viewer = redacted).
- **Audit trail** — every inference and every field read recorded, queryable by run.
- **Data lineage** — which fields were read, when, by which agent.
- **Output discipline** — assumption flagging on every analysis, mock-data labels,
plain-language explanations, same-question-same-answer.
- Trust signals visible in the header: **Shield ON**, model in use, **Powered by Brightcone**.
- Target posture: SOC 2 Type 2 aligned, HIPAA-grade two-tier PII, Claude-native inference.

---

## 7. What we've built (platform + all three POC agents + dashboards)

- ✅ Seeded synthetic dataset (80 reps, the 3 planted findings)
- ✅ **Bright Shield** ingestion (live) + field-level RBAC masking + lineage
- ✅ **CSV/Excel connector** + connector framework (+ Salesforce stub, framework panel)
- ✅ **Client config layer** (DB-backed, one row per client updated in place; seeded from YAML)
- ✅ **Quota Equity agent** (deterministic engine + Claude narrative + fallback)
- ✅ **Capacity Headroom agent** (load scoring, redistribution, two-sided bar chart,
hire/cut what-ifs)
- ✅ **Scenario Orchestrator** (intent routing, conversation context, cross-agent synthesis,
canonical what-ifs: cut N reps / add N heads / headroom query)
- ✅ **Dual interface**: conversational mode **+ three dashboards** (Territory Equity,
Capacity Overview, Executive Summary) with tab switching
- ✅ Governance panels (config ledger, connector framework, audit, lineage), heatmap +
capacity bar with drill-down, role switcher, secure upload
- ✅ Audit + determinism hash; **26 backend tests**; ruff clean; frontend builds
- ✅ **Demo enablement docs**: `docs/DEMO_SCRIPT.md`, `docs/SCENARIOS.md`,
`docs/ARCHITECTURE_SECURITY_ONEPAGER.md`

See `README.md` for run instructions.

---

## 8. What we change / add later (the roadmap)

### Remaining

- Load a real client dataset when provided — the app is **data-independent**: any segments/
  regions work as-is, PII columns are declared in config, and ingest scales to tens of thousands
  of reps. Dropping it into the `reps` table (or pointing `VOIANT_DATABASE_URL` at the client DB)
  is all that's needed.
- Final UI polish pass; production hosting with a stable demo URL.
- Demo rehearsals + joint demo-ready signoff (human steps).

### Out of scope for the POC → Phase 1 / Phase 2 (per the scope doc)

- Territory Intelligence agent · Pipeline Hygiene agent · Comp Expense agent
- Production-grade CRM/Anaplan/Workday/NetSuite connectors (per-client integration)
- Production Shield deployment (POC demonstrates the pattern, not full prod architecture)
- Production per-client onboarding automation
- **User authentication, accounts, multi-tenancy** (POC has none — single demo context)
- Mobile-responsive surface
- Real-time data refresh / live ingestion pipelines

### Things you said you want to revisit together

- Wire your **Anthropic key** in `backend/.env` to turn on live Claude narratives.
- Tune the config ledger / segments / fairness bands per real client interpretation rules.
- Decide hosting + stable demo URL.

---

## 9. Success criteria (from the scope — how we know the POC is done)

The POC is successful when, at the end of Week 4, all are demonstrably true:

- Quota Equity answers "is each rep's quota fair?" with heatmap + ranked output + reasoning
in **under 90s**.
- Capacity Headroom answers "how much more quota can this team carry?" with a bar chart +
reasoning.
- Scenario Orchestrator routes correctly and synthesizes cross-domain answers.
- Both conversational mode **and** three dashboards work, with seamless switching.
- Config layer is visible and updatable **without code redeploy**.
- Shield two-tier ingestion operational with one working connector + field-level masking.
- Shield / audit / assumption-flagging visible on the surface.
- Demo runs end-to-end on synthetic data in **under 15 minutes** without engineer help.
- Hassan completes 3 rehearsals and can run the demo independently.
- Architecture/security one-pager + connector-framework docs available; stable demo URL.

---

## 10. Implementation status — full cross-check against the POC scope

Every line item from §3 (In Scope) and §13 (Success Criteria) of the scope document, with its
status. **Every engineering/code item is done.** Remaining items are human or infrastructure.

### §3.1 Working Agents (Three)


| Scope item                                                             | Status                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Quota Equity: deployed vs top-down target as separate metrics          | ✅                                                                 |
| Quota Equity: detect paintbrushed uniform quota in segments            | ✅                                                                 |
| Quota Equity: per-rep quota-to-opportunity fairness ratio              | ✅                                                                 |
| Quota Equity: heatmap color-coded by fairness band                     | ✅                                                                 |
| Quota Equity: reasoning narrative explaining each flag                 | ✅                                                                 |
| Capacity: per-rep opportunity-load scoring vs baseline                 | ✅                                                                 |
| Capacity: classify under/balanced/over-loaded                          | ✅                                                                 |
| Capacity: aggregate "how much more quota can the team carry"           | ✅                                                                 |
| Capacity: redistribution scenario modeling                             | ✅ (modeled at quota level; account-record granularity is Phase 1) |
| Capacity: two-sided bar chart                                          | ✅                                                                 |
| Capacity: hire-and-cut scenarios (advisory, never naming terminations) | ✅                                                                 |
| Orchestrator: route questions to the right agent                       | ✅                                                                 |
| Orchestrator: maintain conversation context                            | ✅                                                                 |
| Orchestrator: synthesize cross-agent responses                         | ✅                                                                 |
| Orchestrator: canonical what-ifs (cut N, add N heads, more quota)      | ✅                                                                 |
| Orchestrator: re-compute against actual data each invocation           | ✅ (numbers recomputed; narrative cached by determinism hash)      |


### §3.2 Client-Specific Configuration Layer


| Scope item                                                    | Status                          |
| ------------------------------------------------------------- | ------------------------------- |
| Interpretation rules ledger — visible UI panel                | ✅                               |
| Segment definitions (per-client)                              | ✅                               |
| Stage criteria                                                | ✅                               |
| User permissions / RBAC scoping — visible                     | ✅ (config + live role switcher) |
| Structured config; changes apply without redeploy             | ✅ (DB-backed, one row per client, updated live; seeded from YAML) |


### §3.3 Data Sources and Connectors


| Scope item                                                          | Status                     |
| ------------------------------------------------------------------- | -------------------------- |
| Shield two-tier secure ingestion (redaction + re-hydration working) | ✅ (live Bright Shield API) |
| One real working connector — CSV/Excel with field-level masking     | ✅                          |
| Second connector as stub/wireframe — Salesforce                     | ✅ (stub + framework panel) |
| Connector framework documented                                      | ✅                          |
| Data lineage panel                                                  | ✅                          |


### §3.4 Dual Interface


| Scope item                                                                            | Status      |
| ------------------------------------------------------------------------------------- | ----------- |
| Conversational: chat, reasoning + charts + assumptions, invisible routing, follow-ups | ✅           |
| Dashboard: Territory Equity (heatmap, distribution, outlier list, drill-down)         | ✅           |
| Dashboard: Capacity Overview (headroom, rollups, redistribution)                      | ✅           |
| Dashboard: Executive Summary (top-5 findings)                                         | ✅           |
| Each dashboard cell drills down to agent reasoning                                    | ✅           |
| Dashboard ⇄ conversational switching                                                  | ✅ (tab nav) |


### §3.5 Platform Signals

| Shield ON · Assumptions footer · Audit trail panel · Mock-data labels · Powered by Brightcone | ✅ all five |

### §3.6 Synthetic Dataset


| Scope item                                                                     | Status                            |
| ------------------------------------------------------------------------------ | --------------------------------- |
| ~80 reps, 5 segments, 4 regions; quota/attainment/OTE/OTC/pipeline/territory   | ✅                                 |
| Seeded with discoverable findings (paintbrush, overloaded, deployed-vs-target) | ✅                                 |
| Swappable for a real client dataset (data-independent — any segments/regions)  | ✅ (drop in the DB)                |


### §3.7 Demo Enablement Package

| 15-min demo script · 3 scripted scenarios · anticipated questions · architecture/security one-pager | ✅ (`docs/`) |
| Demo rehearsal sessions | ⏳ human step |

### §3.8 Hosting & Demo Infrastructure

| Voiant-branded surface + Powered by Brightcone | ✅ |
| Hosted on Brightcone infra with stable URL; available 60 days | ⏳ infra/deploy |

### §13 Success Criteria


| Criterion                                                                | Status                        |
| ------------------------------------------------------------------------ | ----------------------------- |
| Quota Equity answers fairness with heatmap + ranked + reasoning < 90s    | ✅                             |
| Capacity answers "how much more can the team carry" with bar + reasoning | ✅                             |
| Orchestrator routes correctly + synthesizes cross-domain                 | ✅                             |
| Conversational + 3 dashboards with seamless switching                    | ✅                             |
| Config visible + updatable without redeploy                              | ✅                             |
| Shield two-tier + one connector + field-level masking working            | ✅                             |
| Shield / audit / assumption indicators on the surface                    | ✅                             |
| Demo runs end-to-end on synthetic data < 15 min without intervention     | ✅ (per `docs/DEMO_SCRIPT.md`) |
| Hassan completes 3 rehearsals, can run demo independently                | ⏳ human                       |
| Architecture/security one-pager available as leave-behind                | ✅                             |
| Connector framework documented + demonstrable                            | ✅                             |
| Accessible at a stable URL with uptime                                   | ⏳ infra/deploy                |


**Bottom line:** 100% of the buildable/engineering scope is implemented and verified
(32 backend tests, ruff clean, frontend builds). The only open items are **loading a real client
dataset** (drop-in — the app is data-independent), **demo rehearsals**, and **production
hosting/stable URL** — none of which are code. The Territory Intelligence, Pipeline Hygiene, and Comp Expense agents
are intentionally **out of POC scope** (Phase 1 / Phase 2).

---

*Brightcone — platform & engineering · Voiant — domain, clients, brand, sales.*
*Implementation: separate services agreement per client. Synthetic data only in the POC.*