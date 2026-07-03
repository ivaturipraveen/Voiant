"""Frozen domain entities.

These are immutable and hashable so they can flow through the pure deterministic
engine and into the determinism hash without risk of in-place mutation. Money is a
Decimal-backed quantized type, which is what keeps results byte-stable across runs.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict

from .enums import Region, Segment

_CENTS = Decimal("0.01")


def _to_money(v: object) -> Decimal:
    """Coerce arbitrary numeric input to a 2dp Decimal (deterministic rounding)."""
    if isinstance(v, Decimal):
        d = v
    elif isinstance(v, float):
        # str() first to avoid binary-float artifacts before quantizing.
        d = Decimal(str(v))
    else:
        d = Decimal(str(v))
    return d.quantize(_CENTS, rounding=ROUND_HALF_UP)


# A Decimal money type that always quantizes to cents.
Money = Annotated[Decimal, BeforeValidator(_to_money)]


class Territory(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    region: Region
    account_count: int
    named_accounts: int
    total_addressable_pipeline: Money


class Rep(BaseModel):
    """A single sales rep. PII fields (display_name, email) are masked at rest."""

    model_config = ConfigDict(frozen=True)

    rep_id: str
    display_name: str
    email: str
    segment: Segment
    region: Region
    territory_id: str
    quota: Money
    ote: Money
    otc: Money
    pipeline_value: Money
    attainment: float  # ratio of attained-to-quota, 0..n
