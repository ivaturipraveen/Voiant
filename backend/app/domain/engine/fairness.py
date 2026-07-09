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


def linear_trend_6w(start: float, end: float, points: int = 6) -> list[float]:
    """Interpolate `points` values from start to end (inclusive)."""
    if points < 2:
        return [r6(end)]
    step = (end - start) / (points - 1)
    return [r6(start + step * i) for i in range(points)]


def average_trends_6w(series: list[list[float]], points: int = 6) -> list[float]:
    """Point-wise mean of same-length trend series."""
    if not series:
        return [0.0] * points
    n = min(len(s) for s in series)
    return [r6(sum(s[i] for s in series) / len(series)) for i in range(n)]


def fairness_trend_6w(ratio: float, segment_median: float, points: int = 6) -> list[float]:
    """Six-point fairness-ratio series ending at the rep's current ratio.

    Interpolates from the segment median (fair baseline) when weekly history is
    unavailable, so trend direction and slope reflect the live deviation.
    """
    if points < 2:
        return [ratio]
    if segment_median <= 0:
        return [ratio] * points
    step = (ratio - segment_median) / (points - 1)
    return [r6(segment_median + step * i) for i in range(points)]
