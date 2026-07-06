"""Capacity Headroom agent — load analysis + redistribution + what-if scenarios."""

from __future__ import annotations

import json
import re

from ..domain.engine import capacity as engine
from ..domain.engine.stats import determinism_hash
from ..schemas.capacity import CapacityReport
from ._reps import build_reps, build_trace
from .base import Agent, AgentContext, AgentResult

_NUM_RE = re.compile(r"\b(\d+)\b")


class CapacityHeadroomAgent(Agent):
    name = "capacity_headroom"
    version = "1.0.0"
    required_fields = frozenset(
        {"rep_id", "segment", "region", "quota", "pipeline_value", "display_name"}
    )

    def analyze(self, ctx: AgentContext) -> AgentResult:
        reps = build_reps(ctx, self.name)
        report = engine.compute(reps, ctx.config, ctx.data_source)

        # Detect a canonical what-if scenario in the question and attach its outcome.
        scenario, input_parsing = _detect_scenario(ctx.question, reps, ctx.config)
        if scenario is not None:
            report = report.model_copy(update={"scenario": scenario})

        det_hash = determinism_hash(
            {
                **engine.report_hash_payload(report),
                "config_version": ctx.config.version,
                "snapshot_id": ctx.snapshot_id,
                "scenario": report.scenario.model_dump(mode="json") if report.scenario else None,
            }
        )

        ctx.recorder.record_inference(
            agent=self.name,
            agent_version=self.version,
            determinism_hash=det_hash,
            config_version=ctx.config.version,
            mock_data=ctx.mock_data,
            detail={"findings": len(report.findings), "reps": report.rep_count,
                    "scenario": report.scenario.kind if report.scenario else None},
        )

        narrative, source, model_meta = self._narrate(ctx, report, det_hash)
        trace = build_trace(
            ctx, reps, model_meta, narrative,
            engine_summary={
                "determinism_hash": det_hash,
                "finding_count": len(report.findings),
                "reps_analyzed": report.rep_count,
                "team_additional_capacity": str(report.team_additional_capacity),
                "overloaded": report.overloaded,
                "balanced": report.balanced,
                "underloaded": report.underloaded,
                "scenario": report.scenario.kind if report.scenario else None,
            },
            extra={
                "findings": [
                    {"code": f.code, "severity": f.severity.value, "subject": f.subject,
                     "message": f.message, "evidence": f.evidence}
                    for f in report.findings
                ],
                "assumptions": [
                    {"statement": a.statement, "basis": a.basis, "confidence": a.confidence}
                    for a in report.assumptions
                ],
                "segments": [
                    {"segment": r.segment, "rep_count": r.rep_count,
                     "overloaded": r.overloaded, "underloaded": r.underloaded}
                    for r in report.rollups
                ],
                "input_parsing": input_parsing,
            },
            fields_used=["quota", "pipeline_value", "segment", "region", "attainment"],
            computation=(
                "Capacity Headroom engine: scores each rep's load against a sustainable ceiling "
                "(baseline = segment mean quota), sums how much more quota the team can carry, "
                "counts over-/under-loaded reps and rolls them up by segment, and derives "
                "redistribution moves from overloaded to underloaded reps."
            ),
        )
        return AgentResult(
            report=report,
            narrative=narrative,
            narrative_source=source,
            determinism_hash=det_hash,
            mock_data=ctx.mock_data,
            trace=trace,
        )

    def _narrate(self, ctx: AgentContext, report: CapacityReport, det_hash: str) -> tuple[str, str, dict]:
        payload = _payload(report)
        payload["user_question"] = ctx.question  # answer THIS question specifically
        payload_json = json.dumps(payload, default=str)
        complex_reasoning = report.scenario is not None
        cache_key = _cache_key(det_hash, ctx.question)
        from ..llm import prompts

        system_prompt = prompts.capacity_narrative_prompt()
        if ctx.allow_llm and ctx.llm is not None and getattr(ctx.llm, "enabled", False):
            res = ctx.llm.narrate(payload_json, cache_key, complex_reasoning, system_prompt=system_prompt)
            ctx.recorder.record_llm("capacity_narrative", res.model, res.fell_back)
            meta = {"model": res.model, "fell_back": res.fell_back,
                    "system_prompt": system_prompt, "input_sent": payload_json}
            if not res.fell_back and res.text:
                return res.text, res.model, meta
        else:
            ctx.recorder.record_llm("capacity_narrative", None, True)
        return (
            _deterministic_narrative(report), "deterministic-fallback",
            {"model": None, "fell_back": True, "system_prompt": system_prompt, "input_sent": payload_json},
        )


def _detect_scenario(question: str, reps, config):
    """Parse a what-if scenario out of the raw question. Returns (scenario, parse_detail)
    where parse_detail exposes EXACTLY what we pulled from the text and how — surfaced in
    the trace's 'Input parsing' section so the extraction is fully visible."""
    q = (question or "").lower()
    nums = [int(x) for x in _NUM_RE.findall(q)]
    n = nums[0] if nums else None
    # Match against the regions ACTUALLY present in the data (no hardcoded region list),
    # so any client's regions work. Longest first so "North East" beats "East".
    regions = sorted({str(r.region) for r in reps}, key=len, reverse=True)
    region = next((rg for rg in regions if rg.lower() in q), None)

    cut = any(w in q for w in ("cut", "reduce", "remove", "lay off", "layoff", "fewer"))
    add = any(w in q for w in ("add", "hire", "more heads", "headcount", "new rep"))
    headroom = any(w in q for w in ("how much more", "carry", "absorb", "headroom", "capacity"))

    how: list[str] = []
    if nums:
        how.append(f"Number '{n}' extracted from the text via the digit pattern \\b(\\d+)\\b.")
    if region:
        how.append(f"Region '{region}' matched against the regions present in the data ({', '.join(regions)}).")

    if cut and n:
        how.append("Trigger word (cut/reduce/remove) + a count → simulate REMOVING headcount.")
        scenario, intent, params = engine.simulate_cut(reps, config, n), "cut_heads", {"n": n}
    elif add and n:
        how.append("Trigger word (add/hire/headcount) + a count → simulate ADDING headcount.")
        scenario, intent, params = engine.simulate_add(reps, config, n, region), "add_heads", {"n": n, "region": region}
    elif headroom:
        how.append("Trigger phrase (how much more / carry / absorb / headroom) → base headroom query.")
        scenario, intent, params = engine.headroom_query(reps, config), "headroom_query", {}
    else:
        how.append("No what-if trigger or count found — ran the base capacity analysis over all reps.")
        scenario, intent, params = None, "base_analysis", {}

    parse = {
        "raw_question": question,
        "detected_intent": intent,
        "extracted_params": params,
        "how": how,
    }
    return scenario, parse


def _cache_key(det_hash: str, question: str) -> str:
    import hashlib

    q = hashlib.sha256((question or "").strip().lower().encode()).hexdigest()[:12]
    return f"{det_hash}:{q}"


def _payload(report: CapacityReport) -> dict:
    return {
        "team_total_quota": str(report.team_total_quota),
        "team_additional_capacity": str(report.team_additional_capacity),
        "team_additional_capacity_pct": report.team_additional_capacity_pct,
        "overloaded": report.overloaded,
        "balanced": report.balanced,
        "underloaded": report.underloaded,
        "rollups": [
            {"segment": r.segment, "headroom": str(r.total_headroom),
             "overloaded": r.overloaded, "underloaded": r.underloaded}
            for r in report.rollups
        ],
        "findings": [{"code": f.code, "message": f.message} for f in report.findings],
        "redistribution_moves": len(report.redistribution),
        "scenario": report.scenario.model_dump(mode="json") if report.scenario else None,
        "assumptions": [{"statement": a.statement} for a in report.assumptions],
    }


def _deterministic_narrative(report: CapacityReport) -> str:
    lines: list[str] = []
    lines.append(
        f"**The team can carry ~${_m(report.team_additional_capacity)} more quota** "
        f"({report.team_additional_capacity_pct:.1f}% of current deployed) before reps breach "
        f"the sustainable ceiling. Today {report.overloaded} rep(s) are over-loaded, "
        f"{report.balanced} balanced, and {report.underloaded} under-loaded."
    )
    if report.redistribution:
        moved = sum((m.amount for m in report.redistribution), report.team_total_quota * 0)
        lines.append(
            f"**{len(report.redistribution)} redistribution move(s)** could rebalance "
            f"~${_m(moved)} of quota from over-loaded reps to those with room to absorb more."
        )
    if report.scenario:
        lines.append(f"**Scenario — {report.scenario.kind.replace('_', ' ')}:** {report.scenario.summary}")
    lines.append("_Assumptions to confirm:_ " + "; ".join(a.statement for a in report.assumptions))
    return "\n\n".join(lines)


def _m(value) -> str:
    return f"{float(value) / 1_000_000.0:,.1f}M"
