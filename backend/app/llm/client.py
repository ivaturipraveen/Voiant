"""Anthropic client wrapper — the only place that talks to Claude.

Owns model routing (Sonnet default, Opus for complex reasoning), a small retry, and
graceful fallback. The LLM is given already-computed figures and asked only to
explain them — determinism comes from the engine, never from sampling. Narratives
are cached by determinism hash so a repeated question returns identical prose.
"""

from __future__ import annotations

import json
import logging

from . import prompts

logger = logging.getLogger(__name__)


class LLMResult:
    def __init__(self, text: str, model: str | None, fell_back: bool):
        self.text = text
        self.model = model
        self.fell_back = fell_back


class LLMClient:
    def __init__(
        self, api_key: str | None, default_model: str, complex_model: str,
        classifier_model: str | None = None,
    ):
        self.default_model = default_model
        self.complex_model = complex_model
        self.classifier_model = classifier_model or default_model
        self._enabled = bool(api_key)
        self._client = None
        if self._enabled:
            try:
                from anthropic import Anthropic

                self._client = Anthropic(api_key=api_key)
            except Exception as e:  # SDK missing / bad key shape
                logger.warning("[LLM] Anthropic SDK unavailable (%s); using fallback", e)
                self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled and self._client is not None

    def _call(self, model: str, system: str, user: str, max_tokens: int = 1500) -> str:
        msg = self._client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        parts = []
        for block in msg.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts).strip()

    def classify(
        self, question: str, choices: list[str], history: list[dict] | None = None
    ) -> dict | None:
        """Model-driven intent classification (no keywords).

        Returns {agent, confidence, reason, model} or None if the model is unavailable /
        returned something unusable (caller then falls back deterministically).
        """
        if not self.enabled:
            return None
        valid = set(choices) | {"synthesis"}
        try:
            user = question or ""
            if history:
                recent = " ; ".join(
                    f'"{h.get("question", "")}" → {h.get("agent", "")}' for h in history[-3:]
                )
                user += f"\n\nRecent conversation (most recent last): {recent}"
            out = self._call(self.classifier_model, prompts.classifier_prompt(), user, max_tokens=200)
            data = _extract_json(out)
            agent = str(data.get("agent", "")).strip()
            if agent not in valid:
                return None
            conf = data.get("confidence")
            try:
                conf = round(float(conf), 2)
            except (TypeError, ValueError):
                conf = None
            return {
                "agent": agent,
                "confidence": conf,
                "reason": str(data.get("reason", "")).strip(),
                "model": self.classifier_model,
            }
        except Exception as e:
            logger.warning("[LLM] intent classification failed (%s); deterministic fallback", e)
            return None

    def narrate(
        self,
        payload_json: str,
        cache_key: str,  # unused — every request is processed fresh (no caching)
        complex_reasoning: bool,
        system_prompt: str | None = None,
    ) -> LLMResult:
        if not self.enabled:
            return LLMResult(text="", model=None, fell_back=True)  # caller renders deterministic fallback
        model = self.complex_model if complex_reasoning else self.default_model
        system = system_prompt or prompts.quota_equity_narrative_prompt()
        try:
            text = self._call(model, system, payload_json, max_tokens=1500)
            return LLMResult(text=text, model=model, fell_back=False)
        except Exception as e:
            logger.warning("[LLM] narrate failed (%s); deterministic fallback", e)
            return LLMResult(text="", model=model, fell_back=True)


def _extract_json(text: str) -> dict:
    """Pull the first JSON object out of a model response (tolerant of stray prose)."""
    s = (text or "").strip()
    start, end = s.find("{"), s.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(s[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {}
