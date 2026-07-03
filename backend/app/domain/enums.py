"""Domain enums shared across the engine, agents, and schemas."""

from __future__ import annotations

from enum import StrEnum


class Segment(StrEnum):
    ENTERPRISE = "Enterprise"
    COMMERCIAL = "Commercial"
    MIDMARKET = "Mid-Market"
    SMB = "SMB"
    STRATEGIC = "Strategic"


class Region(StrEnum):
    NORTH = "North"
    SOUTH = "South"
    EAST = "East"
    WEST = "West"


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
