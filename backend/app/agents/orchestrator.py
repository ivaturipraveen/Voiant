"""Scenario Orchestrator.

Coordinates the agents: routes a question to the right one, preserves conversation
context across a session (so vague follow-ups stay on topic), and synthesizes a single
answer when a question spans both quota fairness and capacity. Re-computes against the
actual data on every invocation (never serves cached numbers).
"""

from __future__ import annotations

from dataclasses import dataclass

from . import registry
from .base import AgentContext, AgentResult

_SYNTHESIS_AGENTS = ["quota_equity", "capacity_headroom"]


@dataclass
class Plan:
    mode: str  # "single" | "synthesis"
    agents: list[str]
    routed_from: str
    detail: dict | None = None  # how classification happened (for the technical trace)


def plan(
    question: str, llm: object | None, last_agent: str | None,
    history: list[dict] | None = None,
) -> Plan:
    """Route the question to an agent. Classification is model-driven (a small model reads
    the meaning); if the model is offline we fall back to conversation context, then default."""
    if llm is not None and getattr(llm, "enabled", False):
        c = llm.classify(question, registry.names(), history)
        if c:
            agent = c["agent"]
            detail = {
                "method": "model",
                "model": c.get("model"),
                "confidence": c.get("confidence"),
                "reason": c.get("reason"),
            }
            if agent == "synthesis":
                return Plan("synthesis", list(_SYNTHESIS_AGENTS), "model-classified", detail)
            return Plan("single", [agent], "model-classified", detail)

    # Model unavailable — no keyword guessing: stay on the last agent, else default.
    if last_agent:
        return Plan("single", [last_agent], "context-fallback",
                    {"method": "conversation-context",
                     "reason": f"model offline — stayed on last agent ({last_agent})"})
    return Plan("single", ["quota_equity"], "default",
                {"method": "default", "reason": "model offline — defaulted to quota_equity"})


def run_single(ctx: AgentContext, agent_name: str) -> tuple[AgentResult, str]:
    agent = registry.get(agent_name) or registry.get("quota_equity")
    return agent.analyze(ctx), agent.name


def synthesize(narratives: dict[str, str], reports: dict[str, dict], llm: object | None) -> tuple[str, str]:
    """Combine multiple agent narratives into one. Falls back to a deterministic merge."""
    if llm is not None and getattr(llm, "enabled", False):
        import json

        from ..llm import prompts

        payload = json.dumps({"reports": reports}, default=str)
        res = llm.narrate(payload, cache_key="synth:" + str(hash(payload)), complex_reasoning=True,
                          system_prompt=prompts.synthesis_prompt())
        if not res.fell_back and res.text:
            return res.text, res.model

    # Deterministic synthesis: stitch the per-agent narratives under headers.
    parts = ["**Cross-agent summary (Quota Equity + Capacity Headroom)**"]
    if "quota_equity" in narratives:
        parts.append("**Quota fairness**\n\n" + narratives["quota_equity"])
    if "capacity_headroom" in narratives:
        parts.append("**Capacity**\n\n" + narratives["capacity_headroom"])
    return "\n\n".join(parts), "deterministic-fallback"


def suggested_followups(report_type: str) -> list[str]:
    if report_type == "capacity_headroom":
        return [
            "How much more quota can the team carry?",
            "What if we add 5 heads in the West region?",
            "What if we cut 3 reps?",
            "Which reps are most overloaded?",
        ]
    if report_type == "synthesis":
        return [
            "Which segment has paintbrushed quota?",
            "How much more quota can the team carry?",
            "Give me the executive summary.",
        ]
    return [
        "Which segment has paintbrushed quota?",
        "Show me the top 5 overloaded reps.",
        "How much more quota can the team carry?",
        "Give me the big-picture overview.",
    ]
