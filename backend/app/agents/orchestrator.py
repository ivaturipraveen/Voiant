"""Scenario Orchestrator.

Coordinates the agents: routes a question to the right one, preserves conversation
context across a session (so vague follow-ups stay on topic), and synthesizes a single
answer when a question spans both quota fairness and capacity. Re-computes against the
actual data on every invocation (never serves cached numbers).
"""

from __future__ import annotations

import string
from dataclasses import dataclass

from . import registry
from .base import AgentContext, AgentResult

_SYNTHESIS_AGENTS = ["quota_equity", "capacity_headroom"]


@dataclass
class Plan:
    mode: str  # "single" | "synthesis" | "general"
    agents: list[str]
    routed_from: str
    detail: dict | None = None  # how classification happened (for the technical trace)


def plan(
    question: str, llm: object | None, last_agent: str | None,
    history: list[dict] | None = None,
) -> Plan:
    """Route the question to an agent. Classification is model-driven (a small model reads
    the meaning); if the model is offline we fall back to conversation context, then default."""
    general = _general_chat_intent(question)
    if general is not None:
        return Plan(
            "general",
            [],
            "general-chat",
            {
                "method": "deterministic-general-chat",
                "reason": general,
            },
        )

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
    if last_agent in registry.names():
        return Plan("single", [last_agent], "context-fallback",
                    {"method": "conversation-context",
                     "reason": f"model offline — stayed on last agent ({last_agent})"})
    return Plan("single", ["quota_equity"], "default",
                {"method": "default", "reason": "model offline — defaulted to quota_equity"})


def _general_chat_intent(question: str) -> str | None:
    """Catch obvious non-analytical chat before defaulting into a metric agent.

    This is intentionally conservative: it only catches short greetings/thanks/help prompts
    that do not contain sales-planning terms. Ambiguous business questions still go through
    the normal classifier/fallback path.
    """
    q = (question or "").strip().lower().translate(str.maketrans("", "", string.punctuation))
    q = " ".join(q.split())
    if not q:
        return "Empty prompt; no sales-planning analysis requested."

    sales_terms = {
        "quota", "capacity", "headroom", "rep", "reps", "territory", "territories",
        "segment", "pipeline", "attainment", "fair", "fairness", "overloaded",
        "underloaded", "paintbrush", "paintbrushed", "target", "deployed",
        "redistribute", "redistribution", "cut", "hire", "add heads",
    }
    if any(term in q for term in sales_terms):
        return None

    greetings = {
        "hi", "hello", "hey", "hey there", "good morning", "good afternoon",
        "good evening", "how are you", "how r u", "how are you doing",
    }
    thanks = {"thanks", "thank you", "thx", "ok", "okay", "cool", "got it"}
    help_prompts = {"help", "what can you do", "what can i ask", "who are you"}

    if q in greetings:
        return "Greeting detected; no agent analysis needed."
    if q in thanks:
        return "Acknowledgement detected; no agent analysis needed."
    if q in help_prompts:
        return "General capability question detected; no metric computation needed."
    if len(q.split()) <= 4 and any(q.startswith(prefix) for prefix in ("hi ", "hello ", "hey ")):
        return "Greeting detected; no agent analysis needed."
    return None


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
