"""Demo login — validates a single static username/password held in env
(VOIANT_AUTH_USER / VOIANT_AUTH_PASSWORD). Not a real identity system; it gates the
demo UI so it isn't wide open. No token store — the frontend just remembers success."""

from __future__ import annotations

import hmac

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ...deps import get_runtime
from ...runtime import AppRuntime

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, rt: AppRuntime = Depends(get_runtime)) -> dict:
    s = rt.settings
    # Credentials come only from env; if unset, login is disabled (fail-closed).
    if not s.voiant_auth_user or not s.voiant_auth_password:
        raise HTTPException(status_code=503, detail="Login is not configured on the server")
    ok = hmac.compare_digest(body.username or "", s.voiant_auth_user) and hmac.compare_digest(
        body.password or "", s.voiant_auth_password
    )
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"ok": True, "user": s.voiant_auth_user}
