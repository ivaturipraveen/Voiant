"""Fairness ratio + banding (pure)."""

from __future__ import annotations

from ..enums import FairnessBand
from .stats import r6


def fairness_ratio(quota: float, opportunity: float) -> float:
    """quota / opportunity. Guards a zero/near-zero opportunity."""
    if opportunity <= 0:
        return 0.0
    return r6(quota / opportunity)


def deviation_from_median(ratio: float, segment_median: float) -> float:
    """Signed relative deviation of a rep's ratio from their segment median ratio.

    Positive ⇒ carrying more quota per unit opportunity than the segment norm.
    """
    if segment_median <= 0:
        return 0.0
    return r6((ratio - segment_median) / segment_median)


def band_for_deviation(deviation: float, bands: list) -> FairnessBand:
    """Map a deviation to a FairnessBand using config thresholds (ascending max_deviation).

    Bands are ordered Underloaded → Equitable → Stretched → Overloaded; the first band
    whose `max_deviation` the value does not exceed wins.
    """
    ordered = sorted(bands, key=lambda b: b.max_deviation)
    for b in ordered:
        if deviation <= b.max_deviation:
            return FairnessBand(b.name)
    return FairnessBand(ordered[-1].name)


def color_for_band(band: FairnessBand, bands: list) -> str:
    for b in bands:
        if b.name == band.value:
            return b.color
    return "#9CA3AF"
