"""CSV / Excel connector normalizes to the canonical schema."""

from __future__ import annotations

import io

import pandas as pd

from app.connectors.csv_excel import CsvExcelConnector

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
