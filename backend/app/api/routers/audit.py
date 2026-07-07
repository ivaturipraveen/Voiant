"""Audit + lineage routers — drive the audit-trail and data-lineage panels."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(tags=["audit"])


@router.get("/audit/recent")
def recent_audit(limit: int = 100, rt: AppRuntime = Depends(get_runtime)) -> dict:
    """The browsable audit log — recent analysis runs across all sessions (newest first)."""
    return {"events": rt.audit.recent(limit)}


@router.get("/audit/{run_id}")
def get_audit(run_id: str, rt: AppRuntime = Depends(get_runtime)) -> dict:
    return rt.audit.for_run(run_id)


@router.get("/lineage/{run_id}")
def get_lineage(run_id: str, rt: AppRuntime = Depends(get_runtime)) -> dict:
    return {
        "run_id": run_id,
        "events": rt.lineage.for_run(run_id),
        "summary": rt.lineage.summary_for_run(run_id),
    }


@router.get("/shield/tokens")
def shield_tokens(rt: AppRuntime = Depends(get_runtime)) -> dict:
    """Non-reversible view of the Shield token map (tokens only, no originals)."""
    return {"tokens": rt.shield_store.all_tokens(), "status": rt.shield_status}
