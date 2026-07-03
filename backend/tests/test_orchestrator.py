"""Scenario Orchestrator routing (model-driven) + synthesis planning.

Routing is classified by a small model. We stub the LLM so the tests are deterministic;
with no LLM we assert the deterministic fallback (conversation context, then default).
"""

from __future__ import annotations

from app.agents import orchestrator


class FakeLLM:
    """Minimal stand-in for LLMClient.classify used by the orchestrator."""

    def __init__(self, result: dict | None):
        self.enabled = True
        self._result = result
        self.seen_history = None

    def classify(self, question, choices, history=None):
        self.seen_history = history
        return self._result


def test_model_routes_to_quota():
    llm = FakeLLM({"agent": "quota_equity", "confidence": 0.9, "reason": "fairness", "model": "haiku"})
    p = orchestrator.plan("Is each rep's quota fair?", llm=llm, last_agent=None)
    assert p.mode == "single" and p.agents == ["quota_equity"]
    assert p.routed_from == "model-classified"
    assert p.detail["confidence"] == 0.9


def test_model_routes_to_capacity():
    llm = FakeLLM({"agent": "capacity_headroom", "confidence": 0.8, "reason": "load", "model": "haiku"})
    p = orchestrator.plan("How much more can the team carry?", llm=llm, last_agent=None)
    assert p.agents == ["capacity_headroom"]


def test_model_routes_to_synthesis():
    llm = FakeLLM({"agent": "synthesis", "confidence": 0.7, "reason": "both", "model": "haiku"})
    p = orchestrator.plan("Give me the big-picture overview", llm=llm, last_agent=None)
    assert p.mode == "synthesis"
    assert set(p.agents) == {"quota_equity", "capacity_headroom"}


def test_model_receives_history():
    llm = FakeLLM({"agent": "capacity_headroom", "confidence": 0.6, "reason": "follow-up", "model": "haiku"})
    hist = [{"question": "who is overloaded?", "agent": "capacity_headroom"}]
    orchestrator.plan("what about the west?", llm=llm, last_agent="capacity_headroom", history=hist)
    assert llm.seen_history == hist


def test_fallback_to_last_agent_when_model_offline():
    p = orchestrator.plan("show me the top 5", llm=None, last_agent="capacity_headroom")
    assert p.agents == ["capacity_headroom"]
    assert p.routed_from == "context-fallback"


def test_fallback_to_default_when_offline_and_no_context():
    p = orchestrator.plan("anything", llm=None, last_agent=None)
    assert p.agents == ["quota_equity"]
    assert p.routed_from == "default"


def test_deterministic_synthesis_merge():
    text, src = orchestrator.synthesize(
        {"quota_equity": "QE narrative", "capacity_headroom": "CAP narrative"},
        {"quota_equity": {}, "capacity_headroom": {}},
        llm=None,
    )
    assert "Quota fairness" in text and "Capacity" in text
    assert src == "deterministic-fallback"
