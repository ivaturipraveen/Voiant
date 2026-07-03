"""Agent registry — name -> Agent instance. New agents (Capacity Headroom, Scenario
Orchestrator) drop in here without touching the orchestrator routing seam."""

from __future__ import annotations

from .base import Agent
from .capacity_headroom_agent import CapacityHeadroomAgent
from .quota_equity_agent import QuotaEquityAgent

_AGENTS: dict[str, Agent] = {
    QuotaEquityAgent.name: QuotaEquityAgent(),
    CapacityHeadroomAgent.name: CapacityHeadroomAgent(),
}


def get(name: str) -> Agent | None:
    return _AGENTS.get(name)


def names() -> list[str]:
    return list(_AGENTS.keys())


def describe() -> list[dict]:
    """Live description of the registered agents (for the Behind-the-Scenes view)."""
    return [
        {"name": a.name, "version": a.version, "required_fields": sorted(a.required_fields)}
        for a in _AGENTS.values()
    ]


# The full Agent Library catalog (shared across all clients), with build status.
AGENT_LIBRARY = [
    {"key": "quota_equity", "name": "Quota Equity",
     "responsibility": "Quota fairness; deployed vs top-down target; paintbrush detection; fairness ratio + heatmap.",
     "status": "built", "phase": "POC"},
    {"key": "capacity_headroom", "name": "Capacity Headroom",
     "responsibility": "Rep load scoring; team headroom; redistribution; hire/cut what-ifs.",
     "status": "built", "phase": "POC"},
    {"key": "scenario_orchestrator", "name": "Scenario Orchestrator",
     "responsibility": "Routes questions, keeps conversation context, synthesizes cross-agent answers.",
     "status": "built", "phase": "POC"},
    {"key": "territory_intelligence", "name": "Territory Intelligence",
     "responsibility": "Account moves, TAM, coverage.", "status": "planned", "phase": "Phase 1"},
    {"key": "pipeline_hygiene", "name": "Pipeline Hygiene",
     "responsibility": "Stage validation, activity reads.", "status": "planned", "phase": "Phase 1"},
    {"key": "comp_expense", "name": "Comp Expense",
     "responsibility": "Plan vs paid, accrual & risk (CFO buyer).", "status": "planned", "phase": "Phase 2"},
]
