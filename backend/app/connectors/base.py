"""Connector framework.

Every data source implements the same three-step contract so new sources
(Salesforce, Anaplan, Workday, NetSuite, HubSpot, Pigment) plug in during Phase 1
without touching the agents. Shield redaction sits downstream of `normalize`, so
every connector inherits PII handling for free.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

# Canonical rep fields a connector must produce after normalize().
CANONICAL_FIELDS = [
    "rep_id", "display_name", "email", "segment", "region", "territory_id",
    "quota", "ote", "otc", "pipeline_value", "attainment",
]


@dataclass
class ConnectorResult:
    source: str
    records: list[dict]
    warnings: list[str]


class Connector(ABC):
    """discover -> extract -> normalize."""

    name: str
    status: str = "available"  # available | stub | unavailable

    @abstractmethod
    def discover(self) -> dict:
        """Describe what this connector can pull (schema / objects)."""

    @abstractmethod
    def extract(self, **kwargs) -> list[dict]:
        """Pull raw rows from the source."""

    @abstractmethod
    def normalize(self, rows: list[dict]) -> ConnectorResult:
        """Map raw rows onto CANONICAL_FIELDS."""

    def run(self, **kwargs) -> ConnectorResult:
        rows = self.extract(**kwargs)
        return self.normalize(rows)
