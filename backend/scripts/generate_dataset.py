#!/usr/bin/env python3
"""Generate a synthetic Voiant sales dataset to files (CSV + JSON).

Produces an editable spreadsheet of reps you can inspect, tweak, or upload via the
app's Secure Ingestion. Deterministic (same --seed → identical output).

Usage (from the backend/ directory):

    python scripts/generate_dataset.py                       # -> data/reps.csv, data/reps.json
    python scripts/generate_dataset.py --seed 7 --reps 120   # different seed / size hint
    python scripts/generate_dataset.py --output data/rapid7.csv

Columns match the CSV connector, so the output is directly ingestable:
    rep_id, name, email, segment, region, territory_id,
    quota, ote, otc, pipeline, attainment
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

# Make `app` importable when run as a plain script from backend/.
BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.synth import generator  # noqa: E402

CSV_COLUMNS = [
    "rep_id", "name", "email", "segment", "region", "territory_id",
    "quota", "ote", "otc", "pipeline", "attainment",
]


def _rep_to_csv_row(r: dict) -> dict:
    return {
        "rep_id": r["rep_id"],
        "name": r["display_name"],
        "email": r["email"],
        "segment": r["segment"],
        "region": r["region"],
        "territory_id": r["territory_id"],
        "quota": r["quota"],
        "ote": r["ote"],
        "otc": r["otc"],
        "pipeline": r["pipeline_value"],
        "attainment": r["attainment"],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate a synthetic Voiant sales dataset.")
    ap.add_argument("--seed", type=int, default=42, help="RNG seed (deterministic). Default 42.")
    ap.add_argument("--output", default="data/reps.csv", help="CSV output path. Default data/reps.csv")
    ap.add_argument("--json", default="data/reps.json", help="JSON output path. Default data/reps.json")
    ap.add_argument("--reps", type=int, default=None, help="(informational) target rep count; current generator emits ~80.")
    args = ap.parse_args()

    ds = generator.generate(args.seed)

    out_csv = (BACKEND / args.output) if not Path(args.output).is_absolute() else Path(args.output)
    out_json = (BACKEND / args.json) if not Path(args.json).is_absolute() else Path(args.json)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)

    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in ds.reps:
            w.writerow(_rep_to_csv_row(r))

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump({"manifest": ds.manifest, "reps": ds.reps, "territories": ds.territories}, f, indent=2)

    m = ds.manifest
    print("✅ Generated synthetic dataset")
    print(f"   reps            : {m['rep_count']}")
    print(f"   deployed quota  : ${m['deployed_quota'] / 1e6:,.1f}M")
    print(f"   top-down target : ${m['top_down_target'] / 1e6:,.1f}M")
    print(f"   paintbrushed    : {m['paintbrush_segment']}")
    print(f"   overloaded reps : {', '.join(m['overloaded_rep_ids'])}")
    print(f"   CSV  -> {out_csv}")
    print(f"   JSON -> {out_json}")
    if args.reps:
        print(f"   (note: --reps {args.reps} is informational; edit app/synth/generator.py SEGMENT_COUNTS to change size)")


if __name__ == "__main__":
    main()
