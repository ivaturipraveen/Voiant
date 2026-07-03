"""Seeded synthetic sales-org dataset generator.

Produces ~80 reps across 5 segments and 4 regions with quota / attainment / OTE /
OTC / pipeline / territory fields, and DELIBERATELY plants three discoverable
findings so the agents have something real to surface:

  1. Paintbrushed segment   — one segment where every rep has an identical quota
                              regardless of pipeline (coefficient of variation ≈ 0).
  2. Overloaded reps        — a handful with quota far above their pipeline.
  3. Deployed vs target gap — total deployed quota ≈ $166M against a $130M target.

Everything is seeded, so the dataset is byte-identical across runs.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

SEGMENTS = ["Enterprise", "Commercial", "Mid-Market", "SMB", "Strategic"]
REGIONS = ["North", "South", "East", "West"]

# Reps per segment (sums to 80).
SEGMENT_COUNTS = {"Enterprise": 18, "Commercial": 22, "Mid-Market": 18, "SMB": 14, "Strategic": 8}

# Base annual quota per segment (pre-scaling).
SEGMENT_BASE_QUOTA = {
    "Enterprise": 2_600_000,
    "Commercial": 1_800_000,
    "Mid-Market": 1_500_000,
    "SMB": 900_000,
    "Strategic": 3_200_000,
}

# Typical quota-to-pipeline coverage per segment (pipeline = quota / coverage).
SEGMENT_COVERAGE = {
    "Enterprise": 0.25, "Commercial": 0.33, "Mid-Market": 0.30, "SMB": 0.40, "Strategic": 0.20,
}

PAINTBRUSH_SEGMENT = "Commercial"  # every rep here gets the same quota
TARGET = 130_000_000
DEPLOYED_TARGET = 166_000_000  # what total deployed quota should land near

FIRST_NAMES = [
    "James", "Maria", "David", "Priya", "Michael", "Sofia", "Daniel", "Aisha", "Robert",
    "Linda", "Carlos", "Wei", "Grace", "Omar", "Hannah", "Ethan", "Olivia", "Noah", "Ava",
    "Liam", "Emma", "Lucas", "Mia", "Mason", "Isabella", "Logan", "Amara", "Ravi", "Chloe",
    "Diego", "Yuki", "Fatima", "Henry", "Zara", "Marcus", "Elena", "Tariq", "Nina", "Sean",
]
LAST_NAMES = [
    "Smith", "Patel", "Johnson", "Garcia", "Nguyen", "Kim", "Brown", "Okafor", "Martinez",
    "Lee", "Davis", "Khan", "Wilson", "Rossi", "Chen", "Ali", "Thompson", "Silva", "Murphy",
    "Cohen", "Anderson", "Reyes", "Bauer", "Ivanov", "Costa", "Haddad", "Walsh", "Mehta",
    "Foster", "Yamamoto", "Dubois", "Schmidt", "Adeyemi", "Larsen", "Romano", "Sato",
]


@dataclass
class GeneratedDataset:
    reps: list[dict]
    territories: list[dict]
    manifest: dict


def generate(seed: int = 42) -> GeneratedDataset:
    rng = np.random.default_rng(seed)

    reps: list[dict] = []
    territories: list[dict] = []
    used_names: set[str] = set()

    def unique_name() -> str:
        for _ in range(200):
            fn = FIRST_NAMES[rng.integers(0, len(FIRST_NAMES))]
            ln = LAST_NAMES[rng.integers(0, len(LAST_NAMES))]
            name = f"{fn} {ln}"
            if name not in used_names:
                used_names.add(name)
                return name
        # fallback with suffix
        suffix = len(used_names)
        return f"{fn} {ln} {suffix}"

    rep_idx = 0
    # Pick overloaded reps deterministically: ~6 reps spread across segments.
    overloaded_global = set(int(x) for x in rng.choice(80, size=6, replace=False))

    for segment in SEGMENTS:
        count = SEGMENT_COUNTS[segment]
        base_quota = SEGMENT_BASE_QUOTA[segment]
        coverage = SEGMENT_COVERAGE[segment]

        for _ in range(count):
            region = REGIONS[int(rng.integers(0, len(REGIONS)))]
            terr_id = f"T-{segment[:3].upper()}-{rep_idx:03d}"

            # Quota
            if segment == PAINTBRUSH_SEGMENT:
                quota = float(base_quota)  # identical for the whole segment (paintbrush)
            else:
                quota = float(base_quota * rng.normal(1.0, 0.18))
                quota = max(quota, base_quota * 0.5)

            # Pipeline = quota / coverage, with noise. Overloaded reps get thin pipeline.
            noise = rng.normal(1.0, 0.22)
            pipeline = quota / coverage * max(noise, 0.4)
            if rep_idx in overloaded_global:
                pipeline = quota / coverage * 0.45  # quota far outruns opportunity

            ote = quota * float(rng.uniform(0.45, 0.6))
            otc = ote * 0.5
            attainment = float(np.clip(rng.normal(0.92, 0.22), 0.2, 1.8))

            name = unique_name()
            email = _email_for(name)

            reps.append({
                "rep_id": f"R{rep_idx:03d}",
                "display_name": name,
                "email": email,
                "segment": segment,
                "region": region,
                "territory_id": terr_id,
                "quota": round(quota, 2),
                "ote": round(ote, 2),
                "otc": round(otc, 2),
                "pipeline_value": round(pipeline, 2),
                "attainment": round(attainment, 4),
            })
            territories.append({
                "id": terr_id,
                "region": region,
                "account_count": int(rng.integers(8, 60)),
                "named_accounts": int(rng.integers(2, 15)),
                "total_addressable_pipeline": round(pipeline * float(rng.uniform(1.1, 1.6)), 2),
            })
            rep_idx += 1

    # Scale all quotas so total deployed lands near $166M (preserves all relationships,
    # keeps the paintbrush identical, keeps overloaded reps overloaded).
    total = sum(r["quota"] for r in reps)
    scale = DEPLOYED_TARGET / total
    for r in reps:
        r["quota"] = round(r["quota"] * scale, 2)
        r["ote"] = round(r["ote"] * scale, 2)
        r["otc"] = round(r["otc"] * scale, 2)

    deployed = round(sum(r["quota"] for r in reps), 2)
    manifest = {
        "mock_data": True,
        "seed": seed,
        "rep_count": len(reps),
        "segments": SEGMENTS,
        "regions": REGIONS,
        "deployed_quota": deployed,
        "top_down_target": TARGET,
        "paintbrush_segment": PAINTBRUSH_SEGMENT,
        "overloaded_rep_ids": sorted(f"R{i:03d}" for i in overloaded_global),
    }
    return GeneratedDataset(reps=reps, territories=territories, manifest=manifest)


def _email_for(name: str) -> str:
    local = name.lower().replace(" ", ".")
    return f"{local}@rapid7-sample.com"
