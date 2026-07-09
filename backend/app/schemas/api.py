"""Request/response DTOs for the HTTP API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from .analysis import Assumption


class RunAgentRequest(BaseModel):
    question: str = "Is each rep's quota fair given their territory's opportunity?"
    role: str = "analyst"  # rbac role: analyst | admin | viewer
    session_id: str | None = None


class AgentRunResponse(BaseModel):
    run_id: str
    agent: str  # agent name, or "scenario_orchestrator" for a synthesized answer
    agent_version: str
    report_type: str  # quota_equity | capacity_headroom | synthesis
    question: str
    routed_from: str  # how the orchestrator picked this agent
    report: dict[str, Any]  # serialized agent report (shape depends on report_type)
    narrative: str
    narrative_source: str
    determinism_hash: str
    mock_data: bool
    suggested_followups: list[str]
    session_id: str
    trace: dict[str, Any] | None = None  # per-step technical trace (shield, engine, model I/O)
    memory: list[dict[str, Any]] = []  # conversation turns the assistant remembers this session


class ChatRequest(BaseModel):
    question: str
    role: str = "analyst"
    session_id: str | None = None
    allow_llm: bool = True  # False ⇒ deterministic (used to re-mask instantly on role change)


class ExecMetric(BaseModel):
    label: str
    value: str
    tone: str = "neutral"  # neutral | good | warn | danger


class ExecutiveSummaryResponse(BaseModel):
    run_id: str
    mock_data: bool
    metrics: list[ExecMetric]
    top_findings: list[dict[str, Any]]  # severity-ranked findings from both agents
    narrative: str
    narrative_source: str
    generated_for: str  # role


class RecommendationItem(BaseModel):
    code: str
    priority: str
    title: str
    description: str
    tags: list[str]
    impact: float
    effort: str
    confidence: str


class RecommendationsResponse(BaseModel):
    run_id: str
    mock_data: bool
    recommendations: list[RecommendationItem]
    aggregate_impact: float
    assumptions: list[Assumption]
    paintbrush_segment: str | None = None
    has_redistribution: bool = False
    generated_for: str


class IngestResponse(BaseModel):
    run_id: str
    source: str
    rows: int
    masked_fields: list[str]
    entities_detected: int
    preview: list[dict]  # first few masked rows
    shield_status: str  # "active" | "degraded" | "disabled"
