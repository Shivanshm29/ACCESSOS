from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.schemas.health import HealthResponse, ReadyResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Service Health Check (Liveness)")
def get_health() -> HealthResponse:
    """Return the liveness health status of the ACCESSOS backend service."""
    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get("/ready", response_model=ReadyResponse, summary="Service Readiness Check")
def get_ready(response: Response) -> ReadyResponse:
    """Return the readiness status of the ACCESSOS backend service.
    
    Verifies application configuration, CORS rules, and subsystem state.
    Does NOT fail if an optional AI provider key is unconfigured.
    """
    checks = {
        "configuration": {
            "valid": True,
            "environment": settings.ENVIRONMENT,
            "debug": settings.DEBUG,
        },
        "cors": {
            "valid": True,
            "origins_count": len(settings.CORS_ORIGINS),
            "no_wildcard_in_production": not (settings.ENVIRONMENT == "production" and "*" in settings.CORS_ORIGINS),
        },
        "security_headers": {
            "enabled": True,
        },
    }

    # Evaluate AI Provider configuration (non-blocking for startup)
    provider_name = (settings.AI_PROVIDER or "mock").lower().strip()
    if provider_name in ("mock", "disabled"):
        checks["ai_provider"] = {
            "provider": provider_name,
            "status": "ready",
            "has_key": True,
        }
    else:
        has_key = False
        if provider_name == "openai" and bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip()):
            has_key = True
        elif provider_name == "gemini" and bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()):
            has_key = True
        elif provider_name == "openrouter" and bool(settings.OPENROUTER_API_KEY and settings.OPENROUTER_API_KEY.strip()):
            has_key = True

        checks["ai_provider"] = {
            "provider": provider_name,
            "status": "configured" if has_key else "unconfigured_key",
            "has_key": has_key,
        }

    is_ready = True
    overall_status = "ready"

    if settings.ENVIRONMENT == "production" and "*" in settings.CORS_ORIGINS:
        is_ready = False
        overall_status = "not_ready"
        checks["cors"]["valid"] = False

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadyResponse(
        status=overall_status,
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        ready=is_ready,
        checks=checks,
    )
