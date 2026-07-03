"""The one real working connector: CSV / Excel secure upload.

Reads an uploaded .csv or .xlsx and maps columns onto the canonical rep schema (via the
shared normalizer). PII fields are masked downstream by Shield in the ingest service.
"""

from __future__ import annotations

import io

import pandas as pd

from .base import CANONICAL_FIELDS, Connector, ConnectorResult
from .normalize import normalize_rows


class CsvExcelConnector(Connector):
    name = "csv_excel"
    status = "available"

    def __init__(self, content: bytes | None = None, filename: str = "upload.csv"):
        self._content = content
        self._filename = filename

    def discover(self) -> dict:
        return {"name": self.name, "fields": CANONICAL_FIELDS, "formats": ["csv", "xlsx"]}

    def extract(self, **kwargs) -> list[dict]:
        content = kwargs.get("content", self._content)
        filename = kwargs.get("filename", self._filename)
        if content is None:
            raise ValueError("CsvExcelConnector requires file content")
        buf = io.BytesIO(content)
        if filename.lower().endswith((".xlsx", ".xls")):
            df = pd.read_excel(buf, engine="openpyxl")
        else:
            df = pd.read_csv(buf)
        return df.to_dict(orient="records")

    def normalize(self, rows: list[dict]) -> ConnectorResult:
        records, warnings = normalize_rows(rows)
        return ConnectorResult(source=self.name, records=records, warnings=warnings)
