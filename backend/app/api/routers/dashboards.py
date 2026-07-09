"""Dashboard routers — the three pre-built dashboard views."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_runtime
from ...runtime import AppRuntime
from ...schemas.api import AgentRunResponse, ExecutiveSummaryResponse, RecommendationsResponse
from ...services import dashboard_service

router = APIRouter(prefix="/dashboards", tags=["dashboards"])


@router.get("/territory-equity", response_model=AgentRunResponse)
def territory_equity(role: str = "analyst", rt: AppRuntime = Depends(get_runtime)) -> AgentRunResponse:
    return dashboard_service.territory_equity(rt, role)


@router.get("/capacity-overview", response_model=AgentRunResponse)
def capacity_overview(role: str = "analyst", rt: AppRuntime = Depends(get_runtime)) -> AgentRunResponse:
    return dashboard_service.capacity_overview(rt, role)


@router.get("/executive-summary", response_model=ExecutiveSummaryResponse)
def executive_summary(role: str = "analyst", rt: AppRuntime = Depends(get_runtime)) -> ExecutiveSummaryResponse:
    return dashboard_service.executive_summary(rt, role)


@router.get("/recommendations", response_model=RecommendationsResponse)
def recommendations(role: str = "analyst", rt: AppRuntime = Depends(get_runtime)) -> RecommendationsResponse:
    return dashboard_service.recommendations(rt, role)
