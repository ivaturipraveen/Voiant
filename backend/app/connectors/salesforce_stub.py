"""Salesforce connector — documented stub.

Demonstrates the connector pattern for Phase 1 (sandbox-style integration). Fixes
the shape every production CRM/EPM connector will implement; raises on extract so
the wireframe is honest about being a stub.
"""

from __future__ import annotations

from .base import CANONICAL_FIELDS, Connector, ConnectorResult


class SalesforceConnector(Connector):
    name = "salesforce"
    status = "stub"

    # Field mapping Phase 1 will implement against the Salesforce REST/Bulk API.
    OBJECT_MAP = {
        "User": {"rep_id": "Id", "display_name": "Name", "email": "Email"},
        "Territory2": {"territory_id": "Id", "region": "Region__c"},
        "Opportunity": {"pipeline_value": "SUM(Amount)"},
        "Quota__c": {"quota": "Quota_Amount__c", "ote": "OTE__c", "otc": "OTC__c"},
    }

    def discover(self) -> dict:
        return {
            "name": self.name,
            "status": self.status,
            "auth": "OAuth 2.0 (sandbox)",
            "objects": list(self.OBJECT_MAP.keys()),
            "fields": CANONICAL_FIELDS,
            "note": "Phase 1: per-client SFDC integration. POC ships the framework + this stub.",
        }

    def extract(self, **kwargs) -> list[dict]:
        raise NotImplementedError(
            "Salesforce connector is a Phase 1 deliverable. The POC demonstrates the "
            "connector framework and one working connector (CSV/Excel)."
        )

    def normalize(self, rows: list[dict]) -> ConnectorResult:
        return ConnectorResult(source=self.name, records=[], warnings=["stub connector"])
