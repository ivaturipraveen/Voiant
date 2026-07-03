"""RFC-7807-style error handling."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "type": "about:blank",
            "title": "Internal Server Error",
            "status": 500,
            "detail": str(exc),
            "instance": str(request.url),
        },
    )
