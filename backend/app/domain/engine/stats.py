"""Deterministic statistics helpers.

Everything here is pure and rounding-stable. Floats are rounded to fixed precision
before they ever influence a banding decision or the determinism hash, which is what
prevents cross-run drift.
"""

from __future__ import annotations

import hashlib
import json
from decimal import ROUND_HALF_UP, Decimal

RATIO_DP = Decimal("0.000001")  # 6dp for ratios/deviations


def r6(x: float) -> float:
    """Round a float to 6 dp deterministically (via Decimal)."""
    return float(Decimal(str(x)).quantize(RATIO_DP, rounding=ROUND_HALF_UP))


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 1:
        return r6(s[mid])
    return r6((s[mid - 1] + s[mid]) / 2.0)


def mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return r6(sum(values) / len(values))


def coefficient_of_variation(values: list[float]) -> float:
    """Std / mean. 0 when all values are identical (paintbrush signature)."""
    if not values:
        return 0.0
    m = sum(values) / len(values)
    if m == 0:
        return 0.0
    var = sum((v - m) ** 2 for v in values) / len(values)
    std = var ** 0.5
    return r6(std / m)


def determinism_hash(payload: dict) -> str:
    """SHA-256 over a canonical JSON serialization (sorted keys, Decimal-as-str)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=_default)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _default(o):
    if isinstance(o, Decimal):
        return str(o)
    raise TypeError(f"not serializable: {type(o)}")
