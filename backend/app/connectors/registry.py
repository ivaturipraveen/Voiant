"""Connector registry + the documented Phase-1 framework manifest."""

from __future__ import annotations

from .csv_excel import CsvExcelConnector
from .salesforce_stub import SalesforceConnector

# The connector framework: what's live now vs documented for Phase 1.
FRAMEWORK = [
    {"name": "csv_excel", "label": "CSV / Excel", "status": "available", "phase": "POC"},
    {"name": "database", "label": "SQL Database", "status": "available", "phase": "POC"},
    {"name": "salesforce", "label": "Salesforce", "status": "stub", "phase": "Phase 1"},
    {"name": "anaplan", "label": "Anaplan", "status": "planned", "phase": "Phase 1"},
    {"name": "workday", "label": "Workday", "status": "planned", "phase": "Phase 1"},
    {"name": "netsuite", "label": "NetSuite", "status": "planned", "phase": "Phase 1"},
    {"name": "hubspot", "label": "HubSpot", "status": "planned", "phase": "Phase 1"},
    {"name": "pigment", "label": "Pigment", "status": "planned", "phase": "Phase 1"},
    {"name": "ms_dynamics", "label": "MS Dynamics", "status": "planned", "phase": "Phase 1"},
]


def discover_all() -> list[dict]:
    out = []
    for entry in FRAMEWORK:
        item = dict(entry)
        if entry["name"] == "salesforce":
            item["detail"] = SalesforceConnector().discover()
        out.append(item)
    return out


def csv_connector(content: bytes, filename: str) -> CsvExcelConnector:
    return CsvExcelConnector(content=content, filename=filename)
