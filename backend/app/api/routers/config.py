"""Config layer router — expose the visible ledger + hot-reload."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
def get_config(rt: AppRuntime = Depends(get_runtime)) -> dict:
    cfg = rt.config_loader.current()
    return cfg.model_dump(mode="json")


@router.post("/update")
def update_config(
    patch: dict[str, Any] = Body(...), rt: AppRuntime = Depends(get_runtime)
) -> dict:
    """Apply a partial patch to the live config (validated) and persist it as a new
    version in the DB, which becomes the active config."""
    try:
        cfg = rt.config_loader.update(patch)
    except Exception as e:  # validation error → keep old snapshot
        raise HTTPException(status_code=422, detail=f"Config update failed: {e}") from e
    return cfg.model_dump(mode="json")


@router.post("/reload")
def reload_config(rt: AppRuntime = Depends(get_runtime)) -> dict:
    """Re-fetch the active config from the DB (picks up changes from another worker)."""
    try:
        cfg = rt.config_loader.reload()
    except Exception as e:  # validation / DB error → keep old snapshot
        raise HTTPException(status_code=422, detail=f"Config reload failed: {e}") from e
    return {"reloaded": True, "version": cfg.version, "client_id": cfg.client_id}
