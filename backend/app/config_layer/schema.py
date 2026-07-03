"""Pydantic schema for the client-specific configuration file (the "ledger")."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class InterpretationRule(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: str
    label: str
    rule: str


class SegmentDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    expected_quota_to_pipeline: float
    paintbrush_cv_threshold: float  # CV below this ⇒ "paintbrushed"


class StageCriterion(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    min_probability: float


class FairnessBandConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    max_deviation: float  # upper bound on |deviation| for this band (inf for last)
    color: str


class RoleMasking(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    # field -> masking level: "full" (fully redacted), "initials", "domain_only", "none"
    mask: dict[str, str] = {}
    # fields this role is allowed to read at all (empty ⇒ all)
    allowed_fields: list[str] = []


class ModelRouting(BaseModel):
    model_config = ConfigDict(frozen=True)
    default: str = "claude-sonnet-4-6"
    complex: str = "claude-opus-4-8"


class CapacityConfig(BaseModel):
    """Thresholds for the Capacity Headroom agent's load classification.

    A rep's load_index = quota / segment-baseline-quota. The baseline is the segment
    mean quota (data-driven, deterministic). max_stretch is the top of the 'balanced'
    band used to compute how much more quota a rep / the team can absorb.
    """

    model_config = ConfigDict(frozen=True)
    over_threshold: float = 1.15  # load_index above ⇒ Overloaded
    under_threshold: float = 0.85  # load_index below ⇒ Underloaded
    max_stretch: float = 1.15  # sustainable ceiling for headroom math
    colors: dict[str, str] = {
        "Underloaded": "#3B82F6",
        "Balanced": "#22C55E",
        "Overloaded": "#EF4444",
    }


class CompanyConfig(BaseModel):
    model_config = ConfigDict(frozen=True)
    name: str
    top_down_target: Decimal


class ClientConfig(BaseModel):
    """The full validated client configuration."""

    model_config = ConfigDict(frozen=True)

    client_id: str
    client_name: str
    version: int
    company: CompanyConfig
    interpretation_rules: list[InterpretationRule]
    segment_definitions: list[SegmentDefinition]
    stage_criteria: list[StageCriterion]
    fairness_bands: list[FairnessBandConfig]
    rbac_roles: list[RoleMasking]
    model_routing: ModelRouting = ModelRouting()
    capacity: CapacityConfig = CapacityConfig()

    def segment_def(self, name: str) -> SegmentDefinition | None:
        for s in self.segment_definitions:
            if s.name == name:
                return s
        return None

    def role(self, name: str) -> RoleMasking | None:
        for r in self.rbac_roles:
            if r.name == name:
                return r
        return None
