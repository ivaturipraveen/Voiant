"""Prompt loading. System prompts are frozen text (good for prompt caching) and
explicitly forbid the model from computing or altering any number."""

from __future__ import annotations

from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "config" / "prompts"

_FALLBACK_INTENT = (
    "You are an intent router for a sales-planning assistant. Given a user question, "
    "choose exactly one agent from the provided list that should answer it. "
    "Respond with only the agent name."
)
_FALLBACK_NARRATIVE = (
    "You are a sales-planning analyst. You are given COMPUTED figures as JSON. "
    "Explain the findings in clear, plain language for a CRO or Sales Ops leader. "
    "Do NOT compute, infer, round, or invent any number — cite only values present in "
    "the input. Be concise (3-6 short paragraphs). Lead with the headline finding."
)


def load(name: str, fallback: str) -> str:
    path = _PROMPTS_DIR / name
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return fallback


def intent_router_prompt() -> str:
    return load("intent_router.md", _FALLBACK_INTENT)


def classifier_prompt() -> str:
    """Structured intent classifier — no keywords, a small model reads meaning and returns JSON."""
    return (
        "You are the intent router for Voiant Sales Planning Intelligence. Read the user's "
        "question and decide which specialist should answer it. Reason about MEANING, not "
        "keywords — paraphrases, typos, and follow-ups should still route correctly.\n\n"
        "The specialists:\n"
        "• quota_equity — quota FAIRNESS: is quota spread fairly, is a segment 'paintbrushed' "
        "(everyone given the same number), is deployed quota over the top-down target, which "
        "reps are over/under-assigned relative to their opportunity.\n"
        "• capacity_headroom — team CAPACITY & LOAD: who is overloaded or underloaded, how much "
        "more quota the team can carry, effects of hiring/cutting reps or redistributing load.\n"
        "• synthesis — use ONLY when the question genuinely needs BOTH lenses at once "
        "(e.g. 'overall health', 'give me the big picture', 'rebalance the whole team').\n\n"
        "If the question is a vague follow-up ('what about the west?', 'and now?'), use the "
        "recent-conversation context to stay on the previous specialist.\n\n"
        'Respond with ONLY a JSON object, no prose:\n'
        '{"agent": "quota_equity | capacity_headroom | synthesis", '
        '"confidence": <0.0-1.0>, "reason": "<one short sentence, plain English>"}'
    )


def quota_equity_narrative_prompt() -> str:
    return load("quota_equity_narrative.md", _FALLBACK_NARRATIVE)


def capacity_narrative_prompt() -> str:
    return load("capacity_narrative.md", _FALLBACK_NARRATIVE)


def synthesis_prompt() -> str:
    return (
        "You are the Scenario Orchestrator for Voiant Sales Planning Intelligence. You are "
        "given the computed outputs of multiple agents as JSON. Synthesize ONE coherent, "
        "executive-ready answer that connects quota fairness and capacity. Do NOT invent "
        "numbers — cite only values present in the input. 3–5 short paragraphs."
    )
