"""Analysis service — drive the Scenario Orchestrator (routing, context, synthesis)."""

from __future__ import annotations

from ..agents import orchestrator
from ..agents.base import AgentContext
from ..audit.recorder import AuditRecorder
from ..rbac.context import Principal
from ..runtime import AppRuntime
from ..schemas.api import AgentRunResponse


def _make_ctx(
    rt: AppRuntime, run_id: str, principal: Principal, question: str, allow_llm: bool = True
) -> AgentContext:
    return AgentContext(
        run_id=run_id,
        principal=principal,
        config=rt.config_loader.current(),
        masked_reps=rt.snapshot.masked_reps,
        snapshot_id=rt.snapshot.snapshot_id,
        mock_data=rt.snapshot.mock_data,
        recorder=AuditRecorder(run_id, rt.audit, rt.lineage),
        masker=rt.masker,
        llm=rt.llm,
        question=question,
        allow_llm=allow_llm,
        data_source=rt.snapshot.source,
    )


def run_agent(
    rt: AppRuntime, question: str, role: str, session_id: str | None = None,
    force_agent: str | None = None, allow_llm: bool = True,
) -> AgentRunResponse:
    if rt.snapshot is None:
        rt.bootstrap()

    sid = rt.ensure_session(session_id)
    principal = Principal.for_role(role)

    if force_agent:
        plan = orchestrator.Plan("single", [force_agent], "explicit")
    else:
        plan = orchestrator.plan(
            question, rt.llm, rt.last_agent(sid), rt.session_memory(sid)
        )

    if plan.mode == "synthesis":
        return _run_synthesis(rt, question, principal, sid, plan, allow_llm)

    # Single agent
    run_id = rt.new_run_id()
    ctx = _make_ctx(rt, run_id, principal, question, allow_llm)
    result, agent_name = orchestrator.run_single(ctx, plan.agents[0])
    rt.record_turn(sid, question, agent_name, run_id)

    # Enrich the trace with HOW the query was classified/routed.
    if result.trace is not None:
        from ..agents import registry

        result.trace["routing"] = {
            "chosen_agent": agent_name,
            "routed_from": plan.routed_from,
            "agents_available": registry.names(),
            **(plan.detail or {}),
        }

    return AgentRunResponse(
        run_id=run_id,
        agent=agent_name,
        agent_version="1.0.0",
        report_type=agent_name,
        question=question,
        routed_from=plan.routed_from,
        report=result.report.model_dump(mode="json"),
        narrative=result.narrative,
        narrative_source=result.narrative_source,
        determinism_hash=result.determinism_hash,
        mock_data=result.mock_data,
        suggested_followups=orchestrator.suggested_followups(agent_name),
        session_id=sid,
        trace=result.trace,
        memory=rt.session_memory(sid),
    )


def _run_synthesis(
    rt: AppRuntime, question: str, principal: Principal, sid: str, plan: orchestrator.Plan,
    allow_llm: bool = True,
) -> AgentRunResponse:
    run_id = rt.new_run_id()
    reports: dict[str, dict] = {}
    narratives: dict[str, str] = {}
    sources: list[str] = []
    hashes: list[str] = []
    mock = True
    for agent_name in plan.agents:
        ctx = _make_ctx(rt, run_id, principal, question, allow_llm)
        result, name = orchestrator.run_single(ctx, agent_name)
        reports[name] = result.report.model_dump(mode="json")
        narratives[name] = result.narrative
        sources.append(result.narrative_source)
        hashes.append(result.determinism_hash)
        mock = mock and result.mock_data

    narrative, synth_source = orchestrator.synthesize(
        narratives, reports, rt.llm if allow_llm else None
    )
    rt.record_turn(sid, question, "scenario_orchestrator", run_id)

    return AgentRunResponse(
        run_id=run_id,
        agent="scenario_orchestrator",
        agent_version="1.0.0",
        report_type="synthesis",
        question=question,
        routed_from=plan.routed_from,
        report={"reports": reports, "agents": plan.agents},
        narrative=narrative,
        narrative_source=synth_source,
        determinism_hash="+".join(h[:8] for h in hashes),
        mock_data=mock,
        suggested_followups=orchestrator.suggested_followups("synthesis"),
        session_id=sid,
        memory=rt.session_memory(sid),
    )
