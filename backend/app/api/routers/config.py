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
    """Apply a partial patch to the live config (in-memory, validated). Leaves the YAML
    file untouched; POST /config/reload reverts to the file."""
    try:
        cfg = rt.config_loader.update(patch)
    except Exception as e:  # validation error → keep old snapshot
        raise HTTPException(status_code=422, detail=f"Config update failed: {e}") from e
    return cfg.model_dump(mode="json")


@router.post("/reload")
def reload_config(rt: AppRuntime = Depends(get_runtime)) -> dict:
    try:
        cfg = rt.config_loader.load()
    except Exception as e:  # validation / file error → keep old snapshot
        raise HTTPException(status_code=422, detail=f"Config reload failed: {e}") from e
    return {"reloaded": True, "version": cfg.version, "client_id": cfg.client_id}
