"""Ingest router — CSV/Excel secure upload through Shield; connector framework."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ...connectors.normalize import MissingColumnsError
from ...connectors.registry import discover_all
from ...deps import get_runtime
from ...runtime import AppRuntime
from ...schemas.api import IngestResponse
from ...services import ingest_service

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.get("/connectors")
def connectors() -> dict:
    return {"connectors": discover_all()}


@router.post("/upload", response_model=IngestResponse)
async def upload(
    file: UploadFile = File(...),
    set_active: bool = Form(False),
    rt: AppRuntime = Depends(get_runtime),
) -> IngestResponse:
    content = await file.read()
    try:
        return ingest_service.ingest_csv(rt, content, file.filename or "upload.csv", set_active=set_active)
    except MissingColumnsError as e:
        # 422 with exactly which required columns are missing + the headers we accept.
        raise HTTPException(status_code=422, detail=e.detail) from e
