"""Agent routers — run agents / chat through the Scenario Orchestrator."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...deps import get_runtime
from ...runtime import AppRuntime
from ...schemas.api import AgentRunResponse, ChatRequest, RunAgentRequest
from ...services import analysis_service

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post("/quota-equity/run", response_model=AgentRunResponse)
def run_quota_equity(req: RunAgentRequest, rt: AppRuntime = Depends(get_runtime)) -> AgentRunResponse:
    return analysis_service.run_agent(rt, req.question, req.role, req.session_id, force_agent="quota_equity")


@router.post("/capacity-headroom/run", response_model=AgentRunResponse)
def run_capacity(req: RunAgentRequest, rt: AppRuntime = Depends(get_runtime)) -> AgentRunResponse:
    return analysis_service.run_agent(rt, req.question, req.role, req.session_id, force_agent="capacity_headroom")


@router.post("/chat", response_model=AgentRunResponse)
def chat(req: ChatRequest, rt: AppRuntime = Depends(get_runtime)) -> AgentRunResponse:
    """Conversational entry point — the orchestrator routes (and may synthesize)."""
    return analysis_service.run_agent(
        rt, req.question, req.role, req.session_id, allow_llm=req.allow_llm
    )
