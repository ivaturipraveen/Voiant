# Voiant — Testing Scenarios

What to ask, what you'll see, and why it matters. No setup commands here — those live in the
`README.md`. Just open the app and follow along.

> **App:** [http://localhost:5174/](http://localhost:5174/)  ·  **Data:** synthetic (~80 salespeople) — safe to demo.

---

## How a question flows (the map)

```
  You ask a question (Conversational tab)
            │
            ▼
   ┌──────────────────────┐
   │ SCENARIO ORCHESTRATOR │   picks the right agent (or runs both & merges)
   └──────────┬───────────┘
      ┌───────┴────────┐
      ▼                ▼
 ┌───────────┐   ┌────────────────┐
 │QUOTA EQUITY│  │CAPACITY HEADROOM│   ← a specialist agent, one job each
 └─────┬─────┘   └───────┬────────┘
       │ reads data (Shield-protected)
       │ computes the numbers  ← deterministic (same question → same answer)
       │ Claude writes the explanation  ← words only, never the numbers
       ▼
  Answer = charts + plain-English reasoning + "assumptions to confirm"
```

**The nav has 3 items — different doors into the same brain:**


| Nav item              | What it's for                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Conversational**    | Ask anything (this is where Claude runs)                                                                                                                                         |
| **Dashboards ▾**      | A menu of 3 pre-built views: **Territory Equity** (are quotas fair?), **Capacity Overview** (can we carry more? who's overloaded?), **Executive Summary** (top 5 things to know) |
| **Behind the Scenes** | Technical: agents, pipeline, Shield, audit                                                                                                                                       |


> Dashboards **compute once, then cache** — re-opening a tab is instant (no reload). Use the
> **↻ Refresh** button on a dashboard to recompute it.

> Dashboards compute instantly with **no AI cost** — Claude only runs when you ask a question in
> **Conversational**.

---

## The dataset in one paragraph

80 made-up salespeople ("reps"), across 5 segments (Enterprise…SMB) and 4 regions. It's
deliberately rigged with three problems so the AI has something real to find: **(1)** total
quota adds to **$166M** but the company target is **$130M** (over-assigned); **(2)** the
**Commercial** team all got near-identical quota regardless of territory ("paintbrushed");
**(3)** ~~8 reps are **overloaded** while ~12 have room (~~$26.6M spare capacity).

---

## Roles (the dropdown, top-right)

Same numbers for everyone — only PII visibility changes. Start as **Admin**.


| Role        | Rep names         | Emails               | Can upload/reload? |
| ----------- | ----------------- | -------------------- | ------------------ |
| **Admin**   | Full (Liam Rossi) | Full                 | Yes                |
| **Analyst** | Initials (L. R.)  | Domain-only (l***@…) | Yes                |
| **Viewer**  | Hidden (•••••)    | Hidden               | No (read-only)     |


---

# Testing Scenarios

Each one: **Ask** → **You'll see** → **Why it matters.**

## A · Quota fairness

**1. "Is each rep's quota fair given their territory's opportunity?"** ← the headline

- **You'll see:** Deployed **$166M ≠ $130M** target (27.7% over) · a colored fairness **heatmap** ·
findings incl. paintbrushed **Commercial** and overloaded reps · a written explanation.
- **Why it matters:** Unfair quota is the #1 cause of missed plans and rep churn — this exposes it instantly.

**2. "Which segment has paintbrushed quota?"**

- **You'll see:** The **Commercial** segment flagged (everyone got the same number, CV ≈ 0.000).
- **Why it matters:** "Divide by headcount" quota is quietly unfair — it ignores real territory potential.

**3. "Why is deployed quota above the $130M target?"**

- **You'll see:** Deployed **$166M** vs target **$130M** — a **$36M (27.7%)** over-assignment explained.
- **Why it matters:** Deployed quota and the target are different numbers; conflating them inflates forecasts.

## B · Capacity

**4. "How much more quota can the team carry?"**

- **You'll see:** ~**$26.6M** of headroom (16%) · reps split into over/balanced/under-loaded · a two-sided bar chart.
- **Why it matters:** Answers "can we take a bigger number without hiring?" with evidence.

**5. "Who is overloaded right now?"**

- **You'll see:** The over-loaded reps ranked (carrying far more quota than their pipeline supports).
- **Why it matters:** Overloaded reps are your attrition and miss risk.

**6. "Where should we redistribute quota?"**

- **You'll see:** Specific **redistribution moves** (from overloaded reps → reps with room).
- **Why it matters:** Rebalance before you spend on headcount.

## C · What-if (pressure-test a plan)

**7. " W?"**

- **You'll see:** A scenario panel — **before → after** (80 → 77 reps) and a **feasible / risky** flag.
- **Why it matters:** Test a decision on the real data, live, instead of guessing. (Advisory — never names people.)

**8. "What if we add 5 heads in the West region?"**

- **You'll see:** The extra carryable quota those hires unlock.
- **Why it matters:** Quantifies a hiring decision.

## D · Big-picture

**9. "Give me the big-picture overview."**

- **You'll see:** The **Scenario Orchestrator** runs *both* agents and returns one merged answer (fairness + capacity).
- **Why it matters:** Feels like one brain, not separate tools — the "wow" moment.

## E · Follow-ups (it remembers)

**10. Ask a capacity question, then just: "show me the most overloaded."**

- **You'll see:** It stays on the Capacity agent (context preserved).
- **Why it matters:** Natural conversation, like talking to an analyst.

## F · Security / roles

**11. Open Territory Equity, look at the Outliers table, then switch Role: Admin → Analyst → Viewer.**

- **You'll see:** Names **and** emails re-mask (full → initials → •••••) while every number stays the same.
As Viewer, upload/reload show 🔒 read-only.
- **Why it matters:** Field-level access control — exactly what a security/IT reviewer needs.

## G · Ingestion

**12. In the Secure Ingestion panel, upload one of the sample CSVs (`voiant/samples/`).**

- **You'll see:** Rows ingested, entities detected, and PII masked (`John Smith → [PERSON 1]`). *(Needs Bright Shield active.)*
- **Why it matters:** Proves the secure data path end-to-end.

## H · Behind the Scenes (for technical buyers)

**13. Open Behind the Scenes → click ▶ Run a live trace.**

- **You'll see:** The real pipeline, the agent library, the Shield token vault, and a live trace
(run id, determinism hash, model used, field reads).
- **Why it matters:** Proof it's real — agents, masking, audit, reproducibility — not a black box.

---

# More questions to ask (and what's cached vs. fresh)

**How processing works:** **every question is processed fresh** — no caching. Claude reads *your*
question each time and writes an answer specific to it (~15–20s). Even the exact same question
re-runs. The **numbers are always identical** (the deterministic engine), only the wording of the
explanation may vary slightly between runs.

**Tip:** include a **clear keyword** so the question routes straight to the right agent.

- **Quota keywords:** fair · fairness · paintbrush · deployed · target · equity
- **Capacity keywords:** capacity · headroom · overloaded · underloaded · carry · absorb · redistribute · load

> Dashboards still cost nothing (deterministic, no Claude). Only questions you type in
> **Conversational** call Claude — and now each one is a fresh call.

### 🟢 Quota fairness — *each is answered specifically*

- Show me the quota **fairness** heatmap.
- Which segment got **paintbrush**ed quota?
- How does **deployed** quota compare to the **target**?
- Are quotas **equitable** across the team?
- Who are the biggest **fairness** outliers?
- Is quota **deployed** above the **target**?

### 🟢 Capacity — *each is answered specifically*

-  s
- Show me the team's **headroom**.
- Who is **overloaded** right now?
- Which reps are **underloaded**?
- Who has **capacity** to **absorb** more?
- Where should we **redistribute** quota?
- What's the team's **load** balance?

### 🟡 What-if — *always fresh (each is a new scenario)*

- What if we **cut** 3 reps? / What if we **cut** 5 reps?
- What if we **add** 5 heads in the West region?
- What if we **hire** 10 reps? / What if we **add** 3 in the East?

### 🟢 Big-picture (both agents)

- Give me the **big-picture overview**.
- What's the **overall** state of the plan?
- **Summarize** fairness and capacity.

### 🔵 Follow-ups (stay on the last agent — cheap)

- *(after a capacity question)* "show me the most overloaded"
- *(after a quota question)* "which ones are paintbrushed?"

> **Not built yet (Phase 1/2)** — these route politely but the agent isn't here:
> "analyze our territories", "how healthy is our CRM pipeline?", "what will we pay in commissions?"

---

## Glossary (plain English)


| Term                       | Means                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| **Rep**                    | A salesperson                                                          |
| **Quota**                  | A rep's yearly sales target                                            |
| **Deployed quota**         | All rep quotas added up ($166M)                                        |
| **Top-down target**        | The company's overall goal ($130M)                                     |
| **OTE**                    | On-Target Earnings — total pay (base + commission) if a rep hits quota |
| **OTC**                    | On-Target Commission — just the commission part at 100% quota          |
| **Pipeline / opportunity** | Value of a rep's open deals                                            |
| **Paintbrushed**           | Everyone got the same quota regardless of territory — unfair           |
| **Headroom / capacity**    | How much more quota the team can take before people are overloaded     |
| **Agent**                  | A specialist AI that does one job                                      |
| **Shield**                 | The layer that hides names/emails behind codes                         |
| **RBAC / Role**            | Who can see what (Admin/Analyst/Viewer)                                |
| **Determinism hash**       | A fingerprint proving the same question gives the same numbers         |


*There's also a **?** button in the app header that opens this glossary any time.*