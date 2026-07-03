"""Field-level Shield masking + demasking.

Adapts the user's masking_service.py (chat-message masking) to tabular field values:
detect PII with Bright Shield, replace each redactable span with a stable numbered
token (consistent across the dataset), and persist the reversible mapping. Demasking
re-hydrates tokens for authorized reads and applies RBAC display masking + lineage.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from dataclasses import field as dc_field

from ..config_layer.schema import ClientConfig
from ..rbac import policy as rbac_policy
from ..rbac.context import Principal
from .client import BrightShieldClient
from .store import ShieldStore

_TOKEN_RE = re.compile(r"\[[A-Z0-9 /]+ \d+\]")


@dataclass
class MaskResult:
    masked: str
    entities: list[dict] = dc_field(default_factory=list)  # detected (redactable + not)
    redacted_count: int = 0


class ShieldMasker:
    def __init__(self, client: BrightShieldClient, store: ShieldStore):
        self.client = client
        self.store = store

    @property
    def status(self) -> str:
        return self.client.status

    def mask_value(self, value: str, field: str, source: str) -> MaskResult:
        """Detect PII in a single field value and replace redactable spans with tokens."""
        if value is None:
            return MaskResult(masked="", entities=[])
        text = str(value)
        # Fast path: if this exact value is already vaulted, reuse its token — no Shield call.
        cached = self.store.token_for_value(text)
        if cached is not None:
            return MaskResult(
                masked=cached,
                entities=[{"entity_type": "cached", "masked": cached, "score": 1.0, "redactable": True}],
                redacted_count=1,
            )
        detected = self.client.pii_text_detection(text)
        if not detected:
            return MaskResult(masked=text, entities=[])

        # Bright Masker returns the original PII value per span (no offsets). Mint a
        # stable, dataset-consistent token via the vault and substitute it. Replace the
        # longest originals first so a shorter value can't clobber a longer overlap.
        masked = text
        redacted = 0
        entity_log: list[dict] = []
        for ent in sorted(detected, key=lambda e: -len(e.get("entity_text", ""))):
            etype = (ent.get("entity_type") or "").strip()
            etext = (ent.get("entity_text") or "").strip()
            score = ent.get("score", 0.0)
            if not etype or not etext or etext not in masked:
                continue
            token = self.store.token_for(etype, etext, field, source)
            masked = masked.replace(etext, token)
            redacted += 1
            entity_log.append({"entity_type": etype, "masked": token, "score": score, "redactable": True})

        return MaskResult(masked=masked, entities=entity_log, redacted_count=redacted)

    def mask_record(self, record: dict, sensitive_fields: frozenset[str], source: str) -> tuple[dict, list[dict]]:
        """Mask every sensitive field in a record. Returns (masked_record, entity_log)."""
        out = dict(record)
        log: list[dict] = []
        for fname in sensitive_fields:
            if fname in out and out[fname] not in (None, ""):
                res = self.mask_value(out[fname], fname, source)
                out[fname] = res.masked
                log.extend(res.entities)
        return out, log

    def demask_value(
        self,
        masked_value: str,
        field: str,
        principal: Principal,
        config: ClientConfig,
        run_id: str,
        agent: str,
        recorder=None,
    ) -> str:
        """Re-hydrate tokens in a value for an authorized read, then apply RBAC masking.

        Buffers a lineage row for the field read via the recorder (flushed in bulk at the
        end of the run). A `viewer` whose RBAC level is "full" never sees the original.
        """
        level = rbac_policy.masking_level(principal, field, config)
        if recorder is not None:
            recorder.add_lineage(agent, field, masked_value, principal.id, level)

        if masked_value is None:
            return ""
        text = str(masked_value)

        # Re-hydrate each token found in the value.
        def _resolve(match: re.Match) -> str:
            token = match.group(0)
            original = self.store.original_for(token)
            return original if original is not None else token

        rehydrated = _TOKEN_RE.sub(_resolve, text)
        # Apply role display masking on top of the re-hydrated value.
        return rbac_policy.apply_display_mask(rehydrated, level)
