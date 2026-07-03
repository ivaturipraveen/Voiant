"""Shield router — proxy to Bright Shield PII detection (ported from redact.py)."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(prefix="/shield", tags=["shield"])


class TextPayload(BaseModel):
    text: str


@router.post("/detect")
async def detect(payload: TextPayload, rt: AppRuntime = Depends(get_runtime)) -> dict:
    """Forward to Bright Masker /mask and return the masked text + detected spans."""
    base = rt.settings.bright_shield_base_url.rstrip("/")
    if not base or not rt.settings.bright_shield_enabled:
        return {"results": [], "shield_status": rt.shield_status}
    url = f"{base}/mask"
    body = {"text": payload.text}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
            resp = await client.post(url, headers=headers, json=body)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Bright Shield unreachable: {exc}") from exc
    try:
        data = resp.json()
    except ValueError:
        data = {"results": []}
    return {"status_code": resp.status_code, "data": data, "shield_status": rt.shield_status}
