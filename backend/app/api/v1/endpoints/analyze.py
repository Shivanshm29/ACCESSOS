"""API endpoints for Phase 5 AI Page Analysis."""
import logging
from fastapi import APIRouter, HTTPException, status
from app.ai.orchestrator import AIOrchestrator
from app.ai.providers import (
    AIProviderError,
    ProviderConfigurationError,
    ProviderTimeoutError,
    ProviderRateLimitError,
    MalformedProviderResponseError,
    PROVIDERS,
    get_ai_provider,
)
from app.core.config import settings
from app.schemas.ai_analysis import (
    AIPageAnalysisRequest,
    AIPageAnalysisResponse,
    AIHealthResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["AI Analysis"])


@router.post(
    "/page",
    response_model=AIPageAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze structured page representation using AI",
    description="Sanitizes the page representation and calls the configured AI provider to analyze semantic, linguistic, and cognitive barriers.",
)
async def analyze_page(request: AIPageAnalysisRequest) -> AIPageAnalysisResponse:
    """Analyze a sanitized webpage representation with AI."""
    orchestrator = AIOrchestrator()
    try:
        response = await orchestrator.analyze_page(request)
        return response
    except ProviderConfigurationError as e:
        logger.warning("AI provider configuration issue: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI analysis is temporarily unavailable. Provider configuration is missing.",
        )
    except ProviderTimeoutError as e:
        logger.warning("AI provider timeout: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI analysis is temporarily unavailable. Request timed out.",
        )
    except ProviderRateLimitError as e:
        logger.warning("AI provider rate limit reached: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI analysis is temporarily unavailable. Rate limit exceeded.",
        )
    except MalformedProviderResponseError as e:
        logger.warning("Malformed AI provider response: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI analysis is temporarily unavailable. Provider returned malformed output.",
        )
    except AIProviderError as e:
        logger.error("AI provider error: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI analysis is temporarily unavailable.",
        )
    except Exception as e:
        logger.error("Unexpected error during AI analysis: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI analysis is temporarily unavailable.",
        )


@router.get(
    "/health",
    response_model=AIHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="AI subsystem configuration and readiness check",
)
async def get_ai_health() -> AIHealthResponse:
    """Check AI subsystem status and available providers without exposing keys."""
    active_name = (settings.AI_PROVIDER or "mock").lower()
    has_key = False
    if active_name == "openai":
        has_key = bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY.strip()) > 0)
    elif active_name == "gemini":
        has_key = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 0)
    elif active_name == "openrouter":
        has_key = bool(settings.OPENROUTER_API_KEY and len(settings.OPENROUTER_API_KEY.strip()) > 0)
    elif active_name == "mock":
        has_key = True

    model = settings.AI_MODEL
    if not model:
        if active_name == "openai":
            model = "gpt-4o-mini"
        elif active_name == "gemini":
            model = "gemini-1.5-flash"
        elif active_name == "openrouter":
            model = "meta-llama/llama-3.1-8b-instruct"
        else:
            model = "mock-deterministic-v1"

    return AIHealthResponse(
        status="ready" if has_key else "needs_configuration",
        activeProvider=active_name,
        configuredModel=model,
        availableProviders=list(PROVIDERS.keys()),
        hasApiKey=has_key,
    )
