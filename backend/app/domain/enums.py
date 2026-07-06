"""Domain enums shared across the engine, agents, and schemas."""

from __future__ import annotations

from enum import StrEnum

# NOTE: segment and region are intentionally NOT enums — they are free-form strings taken
# straight from the client's data, so any real dataset's segments/regions work as-is (e.g.
# "Public Sector", "EMEA") without code changes. Only values the ENGINE produces are enums.


class FairnessBand(StrEnum):
    """How a rep's quota compares to the opportunity they carry."""

    UNDERLOADED = "Underloaded"
    EQUITABLE = "Equitable"
    STRETCHED = "Stretched"
    OVERLOADED = "Overloaded"


class FlagSeverity(StrEnum):
    INFO = "info"
    WARN = "warn"
    CRITICAL = "critical"


class FieldSensitivity(StrEnum):
    PUBLIC = "public"
    INTERNAL = "internal"
    PII = "pii"
    RESTRICTED = "restricted"
