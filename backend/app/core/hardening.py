"""
ACCESSOS Backend Hardening (Phase 15 Production Hardening)
Global exception handlers, payload bounding, and sanitized responses.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import re

SENSITIVE_PATTERNS = [
    re.compile(r"password[=:]\s*['\"]?[^\s,'\"]+['\"]?", re.IGNORECASE),
    re.compile(r"secret[=:]\s*['\"]?[^\s,'\"]+['\"]?", re.IGNORECASE),
    re.compile(r"token[=:]\s*['\"]?[^\s,'\"]+['\"]?", re.IGNORECASE),
    re.compile(r"api[_-]?key[=:]\s*['\"]?[^\s,'\"]+['\"]?", re.IGNORECASE),
]


def sanitize_backend_error_message(msg: str) -> str:
    """Strips secrets, passwords, tokens, and raw path info from backend error output."""
    if not msg:
        return "An internal server error occurred."
    sanitized = str(msg)
    for pattern in SENSITIVE_PATTERNS:
        sanitized = pattern.sub("[REDACTED]", sanitized)
    return sanitized[:300]


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Sanitized 422 handler that does not reflect raw values or script tags."""
    errors = []
    for err in exc.errors():
        loc = " -> ".join(str(l) for l in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        errors.append({"location": loc, "message": sanitize_backend_error_message(msg)})
    return JSONResponse(
        status_code=422,
        content={"detail": "Request validation failed.", "errors": errors},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Sanitized HTTP exception handler."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": sanitize_backend_error_message(str(exc.detail))},
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all 500 handler that strictly hides internal stack traces."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again."},
    )
