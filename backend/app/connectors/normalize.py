"""Shared column normalization — maps arbitrary source columns onto the canonical rep
schema. Used by the CSV/Excel connector and the Database connector so any source
(spreadsheet, Postgres, MySQL…) lands in the same shape."""

from __future__ import annotations

# Accepts common header spellings for each canonical field.
ALIASES: dict[str, list[str]] = {
    "rep_id": ["rep_id", "rep id", "id", "employee_id"],
    "display_name": ["display_name", "name", "rep_name", "full_name", "rep"],
    "email": ["email", "email_address", "work_email"],
    "segment": ["segment", "segment_name"],
    "region": ["region", "geo", "area"],
    "territory_id": ["territory_id", "territory", "terr_id"],
    "quota": ["quota", "deployed_quota", "annual_quota"],
    "ote": ["ote", "on_target_earnings"],
    "otc": ["otc", "on_target_commission"],
    "pipeline_value": ["pipeline_value", "pipeline", "open_pipeline"],
    "attainment": ["attainment", "attainment_pct", "quota_attainment"],
}
NUMERIC = {"quota", "ote", "otc", "pipeline_value", "attainment"}

# Columns an upload MUST provide (the analytics are meaningless without them):
#   rep_id         – stable identity (else IDs are fabricated and collide)
#   segment        – the grouping key both engines depend on (medians / baselines)
#   quota          – the primary metric in both engines
#   pipeline_value – denominator of the quota-equity fairness ratio
REQUIRED_FIELDS = ["rep_id", "segment", "quota", "pipeline_value"]


class MissingColumnsError(ValueError):
    """Raised when an upload lacks one or more required canonical columns."""

    def __init__(self, missing: list[str]):
        self.missing = missing
        # Rich, user-facing detail: what's missing + the header spellings we accept.
        self.detail = {
            "error": "missing_required_columns",
            "message": "Upload is missing required column(s): " + ", ".join(missing),
            "missing": missing,
            "required": REQUIRED_FIELDS,
            "accepted_headers": {f: ALIASES.get(f, [f]) for f in missing},
        }
        super().__init__(self.detail["message"])


def present_canonical_fields(rows: list[dict]) -> set[str]:
    """Which canonical fields the raw headers resolve to (canonical key OR any alias,
    case-insensitive). The canonical key itself is always accepted."""
    headers: set[str] = set()
    for r in rows:
        headers |= {str(k).strip().lower() for k in r.keys()}
    present: set[str] = set()
    for field, aliases in ALIASES.items():
        candidates = {field, *aliases}  # always accept the canonical key
        if headers & candidates:
            present.add(field)
    return present


def missing_required_columns(rows: list[dict]) -> list[str]:
    """Required canonical fields not resolvable from the uploaded headers (in order)."""
    present = present_canonical_fields(rows)
    return [f for f in REQUIRED_FIELDS if f not in present]


def to_float(value) -> float:
    if value is None:
        return 0.0
    try:
        s = str(value).replace("$", "").replace(",", "").replace("%", "").strip()
        return float(s) if s else 0.0
    except (TypeError, ValueError):
        return 0.0


def normalize_rows(rows: list[dict]) -> tuple[list[dict], list[str]]:
    """Map raw rows (dicts with any casing/aliases) onto the canonical rep fields."""
    warnings: list[str] = []
    normalized: list[dict] = []
    for i, raw in enumerate(rows):
        low = {str(k).strip().lower(): v for k, v in raw.items()}
        rec: dict = {}
        for field, aliases in ALIASES.items():
            value = None
            for a in aliases:
                if a in low and low[a] is not None and str(low[a]).strip() != "":
                    value = low[a]
                    break
            rec[field] = to_float(value) if field in NUMERIC else ("" if value is None else str(value).strip())
        if not rec.get("rep_id"):
            rec["rep_id"] = f"U{i:04d}"
        normalized.append(rec)
    if normalized and not any(r.get("display_name") for r in normalized):
        warnings.append("No name column detected; rows ingested without rep names.")
    return normalized, warnings
