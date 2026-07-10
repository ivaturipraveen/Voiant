"""Prompt loading.

All prompts live as editable files in `config/prompts/*.md` and load the same way — a
`.md` file plus an in-code fallback if the file is missing. System prompts explicitly forbid
the model from computing or altering any number.

Files (one format for all four):
- intent_classifier.md      — routes a question to an agent (returns JSON)
- quota_equity_narrative.md — explains the Quota Equity figures
- capacity_narrative.md     — explains the Capacity Headroom figures
- synthesis.md              — the Scenario Orchestrator's cross-agent answer
"""

from __future__ import annotations

from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "config" / "prompts"

_FALLBACK_NARRATIVE = (
    "You are a sales-planning analyst. You are given COMPUTED figures as JSON. "
    "Explain the findings in clear, plain language for a CRO or Sales Ops leader. "
    "Do NOT compute, infer, round, or invent any number — cite only values present in "
    "the input. Be concise (3-6 short paragraphs). Lead with the headline finding."
)
_FALLBACK_CLASSIFIER = (
    "You are the intent router for Voiant Sales Planning Intelligence. Choose the specialist for "
    "the question by MEANING (not keywords): quota_equity, capacity_headroom, synthesis, or general. "
    'Respond with ONLY JSON: {"agent": "…", "confidence": <0.0-1.0>, "reason": "…"}'
)
_FALLBACK_SYNTHESIS = (
    "You are the Scenario Orchestrator for Voiant Sales Planning Intelligence. Synthesize ONE "
    "executive-ready answer across the agents' computed outputs. Do NOT invent numbers — cite "
    "only values present in the input. 3–5 short paragraphs."
)


def load(name: str, fallback: str) -> str:
    path = _PROMPTS_DIR / name
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return fallback


def classifier_prompt() -> str:
    return load("intent_classifier.md", _FALLBACK_CLASSIFIER)


def quota_equity_narrative_prompt() -> str:
    return load("quota_equity_narrative.md", _FALLBACK_NARRATIVE)


def capacity_narrative_prompt() -> str:
    return load("capacity_narrative.md", _FALLBACK_NARRATIVE)


def synthesis_prompt() -> str:
    return load("synthesis.md", _FALLBACK_SYNTHESIS)
