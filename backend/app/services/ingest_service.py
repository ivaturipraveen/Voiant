"""Ingest service — connector → Shield mask → snapshot."""

from __future__ import annotations

from ..connectors.registry import csv_connector
from ..runtime import AppRuntime, DatasetSnapshot
from ..schemas.api import IngestResponse


def ingest_csv(rt: AppRuntime, content: bytes, filename: str, set_active: bool = False) -> IngestResponse:
    run_id = rt.new_run_id()
    connector = csv_connector(content, filename)
    result = connector.run(content=content, filename=filename)

    # PII columns → token labels come from the client config (not hardcoded).
    pii_fields = {f.field: f.token_label for f in rt.config_loader.current().pii_fields}
    masked_reps: list[dict] = []
    entities_total = 0
    masked_fields: set[str] = set()
    for rec in result.records:
        masked, ent_log = rt.masker.mask_record(rec, pii_fields, source=filename)
        masked_reps.append(masked)
        entities_total += len(ent_log)
        for e in ent_log:
            if e.get("redactable"):
                masked_fields.add("display_name" if e["entity_type"] == "Person" else e["entity_type"])

    if set_active and masked_reps:
        snapshot = DatasetSnapshot(
            snapshot_id=f"upload-{run_id}",
            source=filename,
            masked_reps=masked_reps,
            manifest={"mock_data": False, "source": filename, "rep_count": len(masked_reps)},
        )
        rt.set_snapshot(snapshot)

    preview = [
        {k: r.get(k) for k in ("rep_id", "display_name", "email", "segment", "quota", "pipeline_value")}
        for r in masked_reps[:5]
    ]

    return IngestResponse(
        run_id=run_id,
        source=filename,
        rows=len(masked_reps),
        masked_fields=sorted(masked_fields),
        entities_detected=entities_total,
        preview=preview,
        shield_status=rt.shield_status,
    )
