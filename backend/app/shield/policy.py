"""Shield policy — which dataset fields carry PII and must be routed through masking."""

from __future__ import annotations

# Dataset fields that carry PII and are sent to Bright Masker on ingest.
SENSITIVE_FIELDS: frozenset[str] = frozenset({"display_name", "email", "phone"})
