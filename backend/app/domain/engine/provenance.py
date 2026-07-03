"""Data-provenance assumption.

Describes the REAL data source the figures were computed on — driven by the active
data source (VOIANT_DATA_SOURCE) and the client config, never a hardcoded claim.
Swap to a real database and this text reflects it automatically; no code change.
"""

from __future__ import annotations

from ...config_layer.schema import ClientConfig
from ...schemas.analysis import Assumption


def provenance_assumption(config: ClientConfig, data_source: str, rep_count: int) -> Assumption:
    company = config.company.name
    src = (data_source or "synthetic").lower()
    if src == "database":
        return Assumption(
            id="data_provenance",
            statement=f"Figures are computed on live data from the connected database ({rep_count} reps).",
            basis="VOIANT_DATA_SOURCE=database — the reps table is the system of record.",
            confidence="high",
        )
    if src == "csv":
        return Assumption(
            id="data_provenance",
            statement=f"Figures are computed on an uploaded {company} dataset ({rep_count} reps).",
            basis="VOIANT_DATA_SOURCE=csv — ingested through secure upload.",
            confidence="high",
        )
    return Assumption(
        id="data_provenance",
        statement=f"Figures are computed on a synthetic, {company}-shaped dataset ({rep_count} reps) — no production data.",
        basis="VOIANT_DATA_SOURCE=synthetic — seeded demo data only.",
        confidence="high",
    )
