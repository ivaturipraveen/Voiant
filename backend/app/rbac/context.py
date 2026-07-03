"""RBAC principal — the identity an analysis runs as."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class Principal(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    role: str  # admin | analyst | viewer

    @classmethod
    def for_role(cls, role: str) -> Principal:
        role = (role or "analyst").lower()
        return cls(id=f"demo-{role}", role=role)
