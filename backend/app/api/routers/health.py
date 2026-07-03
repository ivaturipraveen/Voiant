"""Health + platform-signal status (drives the Shield ON / mock-data header)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(tags=["health"])


@router.get("/health")
def health(rt: AppRuntime = Depends(get_runtime)) -> dict:
    cfg = rt.config_loader.current()
    snap = rt.snapshot
    return {
        "status": "ok",
        "product": "Voiant Sales Planning Intelligence",
        "powered_by": "Brightcone",
        "shield": {
            "status": rt.shield_status,  # active | degraded | disabled
            "base_url": rt.settings.bright_shield_base_url,
        },
        "llm": {
            "enabled": rt.llm.enabled,
            "default_model": rt.settings.voiant_model_default,
            "complex_model": rt.settings.voiant_model_complex,
        },
        "client": {"id": cfg.client_id, "name": cfg.client_name, "config_version": cfg.version},
        "dataset": {
            "loaded": snap is not None,
            "mock_data": snap.mock_data if snap else True,
            "rep_count": len(snap.masked_reps) if snap else 0,
            "snapshot_id": snap.snapshot_id if snap else None,
        },
    }
