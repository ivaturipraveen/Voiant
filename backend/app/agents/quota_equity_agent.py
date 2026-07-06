"""Quota Equity agent — composes shield read → deterministic engine → audit → narrate."""

from __future__ import annotations

import json

from ..domain.engine import quota_equity as engine
from ..schemas.analysis import QuotaEquityReport
from ._reps import build_reps, build_trace
from .base import Agent, AgentContext, AgentResult


class QuotaEquityAgent(Agent):
    name = "quota_equity"
    version = "1.0.0"
    required_fields = frozenset(
        {"rep_id", "segment", "region", "territory_id", "quota", "ote", "otc",
         "pipeline_value", "attainment", "display_name"}
    )

    def analyze(self, ctx: AgentContext) -> AgentResult:
        # 1. Build Rep models from the masked snapshot, demasking display fields per RBAC
        #    (every read is recorded to lineage inside masker.demask_value).
        reps = build_reps(ctx, self.name)

        # 2. Deterministic engine — every number + finding.
        report = engine.compute(reps, ctx.config, ctx.data_source)
        det_hash = engine.report_hash(report, ctx.config.version, ctx.snapshot_id)

        # 3. Audit the inference BEFORE narrating.
        ctx.recorder.record_inference(
            agent=self.name,
            agent_version=self.version,
            determinism_hash=det_hash,
            config_version=ctx.config.version,
            mock_data=ctx.mock_data,
            detail={"findings": len(report.findings), "reps": report.rep_count},
        )

        # 4. Narrate over the computed report (LLM explains, never computes).
        narrative, source, model_meta = self._narrate(ctx, report, det_hash)

        trace = build_trace(
            ctx, reps, model_meta, narrative,
            engine_summary={
                "determinism_hash": det_hash,
                "finding_count": len(report.findings),
                "reps_analyzed": report.rep_count,
                "deployed_quota": str(report.deployed_quota),
                "top_down_target": str(report.top_down_target),
                "over_assignment": str(report.over_assignment),
                "over_assignment_pct": report.over_assignment_pct,
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
                    {"segment": s.segment, "rep_count": s.rep_count,
                     "quota_cv": round(s.quota_cv, 4), "is_paintbrushed": s.is_paintbrushed}
                    for s in report.segments
                ],
                "input_parsing": {
                    "raw_question": ctx.question,
                    "detected_intent": "fairness_analysis",
                    "extracted_params": {},
                    "how": [
                        "No what-if parameters to extract — the question maps to a full quota-"
                        "fairness analysis computed over every rep.",
                    ],
                },
            },
            fields_used=["quota", "pipeline_value", "segment", "region", "territory_id",
                         "attainment", "ote", "otc"],
            computation=(
                "Quota Equity engine: for each rep computes a fairness ratio (quota ÷ pipeline "
                "opportunity), compares it to the segment median, and bands it "
                "(Equitable / Stretched / Overloaded / Underloaded). Per segment it measures the "
                "coefficient of variation of quota to flag 'paintbrushed' (near-uniform) assignment, "
                "and totals deployed quota vs the top-down target."
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

    def _narrate(self, ctx: AgentContext, report: QuotaEquityReport, det_hash: str) -> tuple[str, str, dict]:
        payload = _narrative_payload(report)
        payload["user_question"] = ctx.question  # answer THIS question specifically
        payload_json = json.dumps(payload, default=str)
        complex_reasoning = len(report.findings) >= 4  # route hard cases to Opus
        cache_key = _cache_key(det_hash, ctx.question)
        from ..llm import prompts

        system_prompt = prompts.quota_equity_narrative_prompt()
        if ctx.allow_llm and ctx.llm is not None and getattr(ctx.llm, "enabled", False):
            res = ctx.llm.narrate(payload_json, cache_key, complex_reasoning, system_prompt=system_prompt)
            ctx.recorder.record_llm("quota_equity_narrative", res.model, res.fell_back)
            meta = {"model": res.model, "fell_back": res.fell_back,
                    "system_prompt": system_prompt, "input_sent": payload_json}
            if not res.fell_back and res.text:
                return res.text, res.model, meta
        else:
            ctx.recorder.record_llm("quota_equity_narrative", None, True)
        return (
            _deterministic_narrative(report), "deterministic-fallback",
            {"model": None, "fell_back": True, "system_prompt": system_prompt, "input_sent": payload_json},
        )


def _cache_key(det_hash: str, question: str) -> str:
    import hashlib

    q = hashlib.sha256((question or "").strip().lower().encode()).hexdigest()[:12]
    return f"{det_hash}:{q}"


def _narrative_payload(report: QuotaEquityReport) -> dict:
    return {
        "deployed_quota": str(report.deployed_quota),
        "top_down_target": str(report.top_down_target),
        "over_assignment": str(report.over_assignment),
        "over_assignment_pct": report.over_assignment_pct,
        "rep_count": report.rep_count,
        "segments": [
            {
                "segment": s.segment,
                "rep_count": s.rep_count,
                "quota_cv": s.quota_cv,
                "is_paintbrushed": s.is_paintbrushed,
            }
            for s in report.segments
        ],
        "findings": [
            {"code": f.code, "severity": f.severity.value, "subject": f.subject, "message": f.message}
            for f in report.findings
        ],
        "assumptions": [{"statement": a.statement, "basis": a.basis} for a in report.assumptions],
    }


def _deterministic_narrative(report: QuotaEquityReport) -> str:
    """Template narrative used when Claude is unavailable — same facts, fixed prose."""
    lines: list[str] = []
    dep = _m(report.deployed_quota)
    tgt = _m(report.top_down_target)
    if report.over_assignment > 0:
        lines.append(
            f"**Deployed quota is ${dep} against a ${tgt} top-down target** — an over-assignment "
            f"of ${_m(report.over_assignment)} ({report.over_assignment_pct:.1f}%). These are "
            f"distinct numbers: the company is carrying more deployed quota than its target."
        )
    else:
        lines.append(f"Deployed quota is ${dep} against a ${tgt} top-down target.")

    paint = [s for s in report.segments if s.is_paintbrushed]
    if paint:
        names = ", ".join(s.segment for s in paint)
        lines.append(
            f"**Paintbrushed assignment detected** in {names}: quota is near-uniform across reps "
            f"(coefficient of variation near zero), which ignores real territory differences."
        )

    overloaded = [f for f in report.findings if f.code == "REP_OVERLOADED"]
    if overloaded:
        subjects = ", ".join(f.subject for f in overloaded[:5])
        more = "" if len(overloaded) <= 5 else f" and {len(overloaded) - 5} more"
        lines.append(
            f"**{len(overloaded)} rep(s) are overloaded** — carrying quota well above their "
            f"segment median relative to pipeline: {subjects}{more}."
        )

    lines.append(
        "_Assumptions to confirm:_ " + "; ".join(a.statement for a in report.assumptions)
    )
    return "\n\n".join(lines)


def _m(value) -> str:
    return f"{float(value) / 1_000_000.0:,.1f}M"
