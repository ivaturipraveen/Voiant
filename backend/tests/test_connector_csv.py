"""CSV / Excel connector normalizes to the canonical schema."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.connectors.csv_excel import CsvExcelConnector
from app.connectors.normalize import MissingColumnsError, missing_required_columns

ROWS = [
    {"rep_id": "R1", "name": "Jane Doe", "email": "jane@acme.com", "segment": "Enterprise",
     "region": "North", "quota": "$1,200,000", "pipeline": "4,000,000", "attainment": "95%"},
    {"rep_id": "R2", "name": "Sam Lee", "email": "sam@acme.com", "segment": "SMB",
     "region": "West", "quota": "800000", "pipeline": "2000000", "attainment": "0.8"},
]


def _csv_bytes() -> bytes:
    return pd.DataFrame(ROWS).to_csv(index=False).encode()


def _xlsx_bytes() -> bytes:
    buf = io.BytesIO()
    pd.DataFrame(ROWS).to_excel(buf, index=False, engine="openpyxl")
    return buf.getvalue()


def test_csv_normalizes():
    res = CsvExcelConnector().run(content=_csv_bytes(), filename="reps.csv")
    assert len(res.records) == 2
    r0 = res.records[0]
    assert r0["display_name"] == "Jane Doe"
    assert r0["quota"] == 1_200_000.0
    assert r0["pipeline_value"] == 4_000_000.0
    assert r0["attainment"] == 95.0


def test_csv_and_xlsx_match():
    csv = CsvExcelConnector().run(content=_csv_bytes(), filename="reps.csv").records
    xlsx = CsvExcelConnector().run(content=_xlsx_bytes(), filename="reps.xlsx").records
    assert csv == xlsx


def test_required_columns_accepted_via_canonical_keys():
    """The canonical field names themselves satisfy the required-column check."""
    rows = [{"rep_id": "R1", "segment": "SMB", "quota": "1000", "pipeline_value": "5000"}]
    assert missing_required_columns(rows) == []


def test_required_columns_accepted_via_aliases():
    """Alias spellings (e.g. 'pipeline', 'annual_quota') also satisfy the check."""
    rows = [{"id": "R1", "segment_name": "SMB", "annual_quota": "1000", "open_pipeline": "5000"}]
    assert missing_required_columns(rows) == []


def test_missing_required_columns_reported_in_order():
    rows = [{"segment": "SMB", "region": "West"}]  # no rep_id, quota, pipeline_value
    assert missing_required_columns(rows) == ["rep_id", "quota", "pipeline_value"]


def test_connector_raises_on_missing_required_columns():
    rows = [{"name": "Jane", "region": "West"}]
    df = pd.DataFrame(rows).to_csv(index=False).encode()
    with pytest.raises(MissingColumnsError) as exc:
        CsvExcelConnector().run(content=df, filename="bad.csv")
    detail = exc.value.detail
    assert detail["error"] == "missing_required_columns"
    assert set(detail["missing"]) == {"rep_id", "segment", "quota", "pipeline_value"}
    # The 422 payload tells the uploader which header spellings are accepted.
    assert "annual_quota" in detail["accepted_headers"]["quota"]
