"""Field-level RBAC: decide whether a principal can read a field and how it's masked.

This applies *display* masking on top of Shield. Shield handles PII tokenization at
the data boundary; RBAC decides what an authenticated role is allowed to see when a
value is re-hydrated. The two compose: viewer never triggers demask at all, analyst
sees partial values, admin sees full.
"""

from __future__ import annotations

from ..config_layer.schema import ClientConfig
from .context import Principal


def masking_level(principal: Principal, field: str, config: ClientConfig) -> str:
    """Return the masking level for (role, field): full | initials | domain_only | none."""
    role = config.role(principal.role)
    if role is None:
        return "none"
    return role.mask.get(field, "none")


def can_read_field(principal: Principal, field: str, config: ClientConfig) -> bool:
    role = config.role(principal.role)
    if role is None:
        return False
    if not role.allowed_fields:
        return True
    return field in role.allowed_fields


def apply_display_mask(value: str, level: str) -> str:
    """Apply a display-masking level to an already re-hydrated value."""
    if not value or level == "none":
        return value
    if level == "full":
        return "•••••"
    if level == "initials":
        parts = [p for p in value.split() if p]
        if not parts:
            return "•••••"
        initials = ". ".join(p[0].upper() for p in parts) + "."
        return initials
    if level == "domain_only":
        if "@" in value:
            local, _, domain = value.partition("@")
            return f"{local[0]}***@{domain}" if local else f"***@{domain}"
        return "•••••"
    return value
