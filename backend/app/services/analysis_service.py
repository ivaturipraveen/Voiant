"""Analysis service — drive the Scenario Orchestrator (routing, context, synthesis)."""

from __future__ import annotations

import hashlib
import string

from ..agents import orchestrator
from ..agents.base import AgentContext
from ..audit.recorder import AuditRecorder
from ..rbac.context import Principal
from ..runtime import AppRuntime
from ..schemas.api import AgentRunResponse


def _make_ctx(
    rt: AppRuntime, run_id: str, principal: Principal, question: str, allow_llm: bool = True,
    conversation: list[dict] | None = None,
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
        conversation=conversation,
    )


def run_agent(
    rt: AppRuntime, question: str, role: str, session_id: str | None = None,
    force_agent: str | None = None, allow_llm: bool = True,
    classification: str | None = None,
) -> AgentRunResponse:
    sid = rt.ensure_session(session_id)
    principal = Principal.for_role(role)

    if force_agent:
        plan = orchestrator.Plan("single", [force_agent], "explicit")
    elif classification:
        if classification == "general":
            plan = orchestrator.Plan("general", [], "client-classified")
        elif classification == "synthesis":
            plan = orchestrator.Plan("synthesis", ["quota_equity", "capacity_headroom"], "client-classified")
        else:
            plan = orchestrator.Plan("single", [classification], "client-classified")
    else:
        plan = orchestrator.plan(
            question, rt.llm, rt.last_agent(sid), rt.session_memory(sid)
        )

    if plan.mode == "general":
        return _run_general(rt, question, sid, plan)

    if rt.snapshot is None:
        rt.bootstrap()

    if plan.mode == "synthesis":
        return _run_synthesis(rt, question, principal, sid, plan, allow_llm)

    # Single agent
    run_id = rt.new_run_id()
    ctx = _make_ctx(rt, run_id, principal, question, allow_llm, rt.session_memory(sid))
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


def _run_general(
    rt: AppRuntime, question: str, sid: str, plan: orchestrator.Plan,
) -> AgentRunResponse:
    run_id = rt.new_run_id()
    q = (question or "").strip().lower().translate(str.maketrans("", "", string.punctuation))
    q = " ".join(q.split())
    if q in {"help", "what can you do", "what can i ask", "who are you"}:
        narrative = (
            "I can help with Voiant sales-planning questions: quota fairness, "
            "paintbrushed segments, overloaded reps, team headroom, redistribution, "
            "and add/cut headcount what-ifs."
        )
    elif q in {"thanks", "thank you", "thx", "ok", "okay", "cool", "got it"}:
        narrative = "Got it. Ask me a sales-planning question when you want to run an analysis."
    else:
        narrative = (
            "I am the Voiant Sales Planning assistant. I can help you with sales-planning "
            "questions (such as quota fairness, capacity headroom, overloaded reps, "
            "paintbrushed segments, or add/cut headcount scenarios). Please ask me a sales-related question!"
        )

    # Let the LLM answer general/conversational questions directly if enabled
    if rt.llm is not None and getattr(rt.llm, "enabled", False):
        try:
            import json

            system_prompt = (
                "You are the Voiant Sales Planning assistant. The user is asking a general, "
                "conversational, or conceptual planning question (e.g. asking for definitions or "
                "explanations of terms like territory quota, headroom, paintbrushed segments, etc.).\n\n"
                "Instructions:\n"
                "1. If the question is completely off-topic or unrelated to sales planning, business concepts, "
                "or Voiant capabilities (such as asking about database management systems (DBMS), general coding, "
                "recipes, weather, general sports, personal plans, general history, etc.), you MUST immediately "
                "and politely decline to answer. Do NOT validate the query (do NOT say 'Great question!' or 'That's interesting!'), "
                "do NOT define the off-topic term, and do NOT discuss the off-topic topic at all. Start your response directly with: "
                "'I am the Voiant Sales Planning assistant. I can only help you with sales-related questions...' and list "
                "your capabilities (quota fairness, capacity headroom, overloaded reps, paintbrushed segments, what-if headcount changes).\n"
                "2. If explaining a conceptual sales planning term, define it clearly and briefly in simple business terms.\n"
                "3. If the question is general chitchat or greetings, answer briefly, professionally, and in a friendly manner.\n"
                "4. End your response by politely reminding the user that you can run actual analytical calculations "
                "or scenarios (like checking quota fairness, overloaded reps, or what-if headcount changes) "
                "if they ask about their team's data."
            )
            payload = json.dumps({"user_question": question})
            res = rt.llm.narrate(payload, f"general:{question}", False, system_prompt)
            if not res.fell_back and res.text:
                narrative = res.text
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("[LLM] general chat generation failed (%s); using fallback", e)

    rt.record_turn(sid, question, "general", run_id)
    digest = hashlib.sha256(f"general:{question}".encode()).hexdigest()[:16]
    return AgentRunResponse(
        run_id=run_id,
        agent="scenario_orchestrator",
        agent_version="1.0.0",
        report_type="general",
        question=question,
        routed_from=plan.routed_from,
        report={"kind": "general_chat"},
        narrative=narrative,
        narrative_source="deterministic-fallback",
        determinism_hash=digest,
        mock_data=rt.snapshot.mock_data if rt.snapshot is not None else True,
        suggested_followups=[
            "Is each rep's quota fair?",
            "How much more quota can the team carry?",
            "Which reps are overloaded?",
            "What if we add 5 heads in the West region?",
        ],
        session_id=sid,
        trace={
            "routing": {
                "chosen_agent": "scenario_orchestrator",
                "routed_from": plan.routed_from,
                "agents_available": ["quota_equity", "capacity_headroom"],
                **(plan.detail or {}),
            },
            "engine": {
                "analysis_ran": False,
                "reason": "General chat response; no sales-planning metrics requested.",
            },
        },
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
        ctx = _make_ctx(rt, run_id, principal, question, allow_llm, rt.session_memory(sid))
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
