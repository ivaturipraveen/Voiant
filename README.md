# Voiant Sales Planning Intelligence — POC

Agentic sales-planning / RevOps demo product. **Powered by Brightcone.**

A Voiant-branded web app: ask a sales-planning question in plain language, and a
deterministic analytics engine + Claude reasoning answer it over a synthetic,
Rapid7-shaped dataset — with a visible client-config layer, Bright Shield secure
ingestion, and full audit/lineage. Built to satisfy "same question → same answer"
and survive a CISO review.

> This is the **foundation slice**: the Quota Equity agent end-to-end plus the
> platform (data layer, Shield ingestion, config layer, governance signals).
> Capacity Headroom, the Scenario Orchestrator, and the three dashboards are the
> next passes — the extension seams are already in place.

---

## Architecture

```
React (Vite + TS + Tailwind)            Python FastAPI
┌──────────────────────────┐            ┌───────────────────────────────────────────┐
│ Chat + Quota Equity view │  /api  →   │ routers → services → agents → ENGINE (pure) │
│ Heatmap · narrative      │            │                       │                     │
│ Config ledger · audit    │            │   orchestrator ── route ─→ QuotaEquityAgent │
│ Shield ON · mock-data    │            │         │                  │  deterministic  │
└──────────────────────────┘            │      LLMClient        ShieldMasker  + audit │
                                        │   (Claude 4.6/4.8)   (Bright Shield)        │
                                        └───────────────────────────────────────────┘
```

**Determinism guarantee.** The pure engine (`app/domain/engine`) computes every
number and finding. Claude only *routes intent* and *narrates* over already-computed
figures — it never produces a number. If Claude is unavailable, a deterministic
narrative renders the identical facts. Results are hashed (`determinism_hash`) and
identical across runs.

**Shield (two-tier secure ingestion).** Tier 1: Bright Shield (`/rpc/text-detect`)
detects PII. Tier 2: each redactable span is replaced with a stable numbered token
(`[PERSON 1]`), the reversible mapping is persisted, and authorized reads re-hydrate
under field-level RBAC. Every field read is recorded to data lineage.

---

## Quick start

### 1. Backend (FastAPI)

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit .env (see below)
uvicorn app.main:app --reload --port 8000
```

- API docs: <http://localhost:8000/docs>
- Health / platform signals: <http://localhost:8000/health>

On startup the seeded synthetic dataset (80 reps) is generated and ingested through
Shield automatically.

#### `.env` keys that matter

| Key | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables live Claude narratives + intent routing. **Leave blank to run fully offline** with deterministic narratives (numbers are identical either way). |
| `BRIGHT_SHIELD_BASE_URL` | Bright Shield endpoint (default `https://bright-shield.brightcone.ai`). |
| `BRIGHT_SHIELD_ENABLED` | `true` to mask via the live service; `false` to skip masking (e.g. offline dev/tests). |
| `VOIANT_MODEL_DEFAULT` / `VOIANT_MODEL_COMPLEX` | Model routing — Sonnet default, Opus for complex reasoning. |
| `VOIANT_CONFIG_PATH` | Active client config (the ledger). |

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api → :8000)
```

---

## Demo walkthrough (≈ the 15-minute flow)

1. Open the app. The header shows **Shield ON**, the **MOCK DATA** badge, the Claude
   model, and **Powered by Brightcone**.
2. Ask: **"Is each rep's quota fair given their territory's opportunity?"**
   - Returns deployed **$166M** vs target **$130M** (~27.7% over), a paintbrushed
     **Commercial** segment, and overloaded reps — as a **heatmap**, findings, and a
     reasoning narrative, in seconds.
   - Click any heatmap cell to **drill down** to the rep's evidence.
3. Switch the **Role** (analyst → admin → viewer) and watch rep names re-mask live
   (initials → full → fully redacted) — the RBAC + Shield boundary in action.
4. Open the **Client Config — Interpretation Ledger** panel (the `$130M ≠ $166M`
   rule). Edit `backend/config/client_rapid7.yaml`, hit **Reload ↻** — the config
   version bumps with no redeploy.
5. **Upload & mask through Shield**: drop a CSV/Excel of reps; PII is tokenized on the
   way in. The **Audit & Data Lineage** panel shows which fields each agent read.
6. Note the **Assumptions to confirm** footer under every analysis.

---

## Tests & checks

```bash
cd backend
source .venv/bin/activate
pytest            # engine golden-master, determinism, Shield round-trip, connector, config reload
ruff check app tests
```

```bash
cd frontend
npm run build     # TypeScript strict + Vite production build
```

---

## What's built vs what's next

| Built (POC scope complete) | Next (Phase 1 / 2) |
| --- | --- |
| Quota Equity agent | Territory Intelligence agent |
| Capacity Headroom agent (load, redistribution, what-ifs) | Pipeline Hygiene agent |
| Scenario Orchestrator (routing, context, synthesis) | Comp Expense agent (CFO) |
| Conversational mode + 3 dashboards (Territory / Capacity / Exec) | Production Salesforce/Anaplan/Workday/NetSuite connectors |
| CSV/Excel connector + framework + Salesforce stub | Production Shield deployment |
| Bright Shield ingestion + field-level RBAC | Auth / accounts / multi-tenancy |

See **`docs/TESTING_GUIDE.md`** for a section-by-section guide (what each part is, why it's
useful, and how to test it — plus sample questions and the 15-minute demo flow), and
`docs/ARCHITECTURE_SECURITY_ONEPAGER.md` for the buyer leave-behind.

---

_Brightcone — platform & engineering. Voiant — domain, clients, brand, sales._
_Synthetic data only; no production data is processed in the POC._
