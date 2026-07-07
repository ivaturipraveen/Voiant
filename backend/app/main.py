"""FastAPI application factory for Voiant Sales Planning Intelligence."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.errors import unhandled_exception_handler
from .api.routers import agents, audit, auth, config, dashboards, health, ingest, shield, system
from .runtime import AppRuntime
from .settings import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s | %(message)s")
logger = logging.getLogger("voiant")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    runtime = AppRuntime(settings)
    runtime.bootstrap()  # load dataset from the configured source + Shield-ingest it
    app.state.runtime = runtime
    logger.info("[VOIANT] Ready. Shield=%s LLM=%s", runtime.shield_status, runtime.llm.enabled)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Voiant Sales Planning Intelligence",
        description="Agentic sales planning — powered by Brightcone.",
        version="0.1.0",
        lifespan=lifespan,
    )
    # VOIANT_FRONTEND_ORIGIN may be a comma-separated list; browsers send Origin with no
    # trailing slash, so normalize (split, trim, strip trailing "/") to match reliably.
    configured = [
        o.strip().rstrip("/")
        for o in (settings.voiant_frontend_origin or "").split(",")
        if o.strip()
    ]
    allow_origins = list(dict.fromkeys(
        configured + ["http://localhost:5173", "http://localhost:5174"]
    ))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        # Also allow any Render-hosted frontend and the brightcone.ai custom domain
        # (incl. voiant.brightcone.ai) — survives URL changes / redeploys.
        allow_origin_regex=r"https://(.*\.onrender\.com|(.*\.)?brightcone\.ai)",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(Exception, unhandled_exception_handler)

    for r in (health.router, auth.router, config.router, ingest.router, agents.router,
              dashboards.router, audit.router, shield.router, system.router):
        app.include_router(r)
    return app


app = create_app()
