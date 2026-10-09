import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.endpoints.health import router as health_router, get_ready
from app.api.v1.router import api_router

logger = logging.getLogger("accessos.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager handling startup and shutdown events."""
    logger.info(
        "ACCESSOS Backend starting up: service='%s' version='%s' env='%s' host='%s' port=%d provider='%s'",
        settings.PROJECT_NAME,
        settings.VERSION,
        settings.ENVIRONMENT,
        settings.HOST,
        settings.PORT,
        settings.AI_PROVIDER,
    )
    yield
    logger.info("ACCESSOS Backend shutting down gracefully.")


def create_application() -> FastAPI:
    """Application factory for ACCESSOS backend."""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="ACCESSOS Backend - AI-powered digital accessibility and navigation assistance foundation.",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Configure CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging middleware (sanitized, zero-PII, zero-credential)
    @application.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        # Log strictly method, path, status, duration
        logger.info(
            "%s %s -> %d (%.2fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    # Security response headers middleware
    @application.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response

    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException
    from app.core.hardening import (
        validation_exception_handler,
        http_exception_handler,
        generic_exception_handler,
    )

    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(Exception, generic_exception_handler)

    # Expose root-level health and readiness endpoints
    application.include_router(health_router)
    application.add_api_route("/ready", get_ready, methods=["GET"], tags=["Health"], summary="Root Readiness Check")

    # Expose versioned API router (GET /api/v1/health, etc.)
    application.include_router(api_router, prefix="/api/v1")

    @application.get("/", tags=["Root"])
    def root():
        return {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "docs": "/docs" if settings.DEBUG else "disabled_in_production",
            "health": "/health",
            "ready": "/ready",
        }

    return application


app = create_application()
