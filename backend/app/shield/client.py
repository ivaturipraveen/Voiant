"""Bright Masker client — PII detection & masking.

Calls the Bright Masker `POST /mask` endpoint, which returns the masked text plus
`spans` (each with the original value, a masked token, entity id, and confidence).
We use the detected `spans` and mint our own *stable, dataset-consistent* tokens via
the Shield vault (so "Liam Rossi" always maps to the same token and can be demasked).

Fails *open* (returns []) on any error so the demo keeps working when the service is
unreachable or its licence lapses — the header surfaces this as a "degraded" state.
"""

from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)

# Map Bright Masker entity ids → the short label we use in tokens ([PERSON 1], …).
_ENTITY_LABEL = {
    "person_name": "PERSON",
    "email_address": "EMAIL",
    "phone_number": "PHONE",
    "ssn": "SSN",
    "credit_card": "CREDIT CARD",
    "date_of_birth": "DOB",
    "address": "ADDRESS",
    "ip_address": "IP",
    "url": "URL",
    "bank_account": "BANK ACCOUNT",
    "passport": "PASSPORT",
}


def label_for(entity_id: str) -> str:
    return _ENTITY_LABEL.get(entity_id, (entity_id or "PII").replace("_", " ").upper())


class BrightShieldClient:
    _FAILURE_THRESHOLD = 3

    def __init__(self, base_url: str, enabled: bool = True, timeout_seconds: int = 60):
        self.base_url = (base_url or "").rstrip("/")
        self.enabled = enabled and bool(self.base_url)
        self.timeout_seconds = timeout_seconds or 60
        self._consecutive_failures = 0
        self._breaker_open = False

    @property
    def status(self) -> str:
        if not self.enabled:
            return "disabled"
        if self._breaker_open:
            return "degraded"
        return "active"

    def _record_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._FAILURE_THRESHOLD:
            if not self._breaker_open:
                logger.warning(
                    "[SHIELD] %d consecutive failures — opening circuit breaker; "
                    "masking skipped (degraded)",
                    self._consecutive_failures,
                )
            self._breaker_open = True

    def _record_success(self) -> None:
        self._consecutive_failures = 0
        self._breaker_open = False

    def pii_text_detection(self, text: str) -> list[dict]:
        """Return detected PII spans as [{entity_type, entity_text, score}].

        `entity_type` is our short label (PERSON/EMAIL/…), `entity_text` is the original
        value. Any failure returns [] (fail-open) and masking is skipped.
        """
        if not self.enabled or self._breaker_open or not text or not text.strip():
            return []

        url = f"{self.base_url}/mask"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        try:
            resp = requests.post(url, headers=headers, json={"text": text}, timeout=self.timeout_seconds)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            logger.warning("[SHIELD] mask failed (%s); masking skipped for this value", e)
            self._record_failure()
            return []
        except ValueError:
            logger.warning("[SHIELD] mask returned non-JSON; masking skipped")
            self._record_failure()
            return []

        self._record_success()
        spans = data.get("spans") if isinstance(data, dict) else None
        if not isinstance(spans, list):
            return []
        out: list[dict] = []
        for s in spans:
            original = (s.get("original") or "").strip()
            if not original:
                continue
            out.append(
                {
                    "entity_type": label_for(s.get("entity_id", "")),
                    "entity_text": original,
                    "score": s.get("confidence", 0.0),
                }
            )
        return out
