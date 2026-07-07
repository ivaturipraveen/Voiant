"""Agent abstraction.

The base interface is deliberately small. Everything cross-cutting — shielded reads,
audit, narrative — is provided through the context, so each agent stays focused on
its own deterministic computation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel

from ..audit.recorder import AuditRecorder
from ..config_layer.schema import ClientConfig
from ..rbac.context import Principal
from ..shield.masking import ShieldMasker


@dataclass
class AgentContext:
    run_id: str
    principal: Principal
    config: ClientConfig
    masked_reps: list[dict]  # snapshot records (PII fields masked)
    snapshot_id: str
    mock_data: bool
    recorder: AuditRecorder
    masker: ShieldMasker
    llm: object | None  # LLMClient | None  (None ⇒ deterministic-only)
    question: str
    allow_llm: bool = True  # False ⇒ skip Claude (dashboards: deterministic-only, no cost)
    data_source: str = "synthetic"  # database | csv | synthetic — real provenance for assumptions/trace
    conversation: list[dict] | None = None  # prior turns this session (for follow-up continuity)


@dataclass
class AgentResult:
    report: BaseModel
    narrative: str
    narrative_source: str  # model id | "deterministic-fallback"
    determinism_hash: str
    mock_data: bool
    trace: dict | None = None  # per-step technical trace (shield sample, engine, model I/O)


class Agent(ABC):
    name: str
    version: str
    required_fields: frozenset[str]

    @abstractmethod
    def analyze(self, ctx: AgentContext) -> AgentResult: ...
