"""API endpoints for Phase 7 Explain Anything."""
import logging
from fastapi import APIRouter, HTTPException, status
from app.explain.orchestrator import ExplainOrchestrator
from app.explain.schemas import (
    ExplainAnythingRequest,
    ExplainAnythingResponse,
    ExplanationMode,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/explain", tags=["Explain Anything"])


@router.post(
    "",
    response_model=ExplainAnythingResponse,
    status_code=status.HTTP_200_OK,
    summary="Explain selected webpage text",
    description="Transforms selected webpage text into plain-language explanations with terminology definitions.",
)
@router.post(
    "/",
    response_model=ExplainAnythingResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
@router.post(
    "/start",
    response_model=ExplainAnythingResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def explain_anything(request: ExplainAnythingRequest) -> ExplainAnythingResponse:
    """Generate concise, accessible plain-language explanation of selected webpage content."""
    orchestrator = ExplainOrchestrator()
    try:
        response = await orchestrator.explain(request)
        return response
    except Exception as e:
        logger.error("Unexpected error in Explain Anything generation: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Explain Anything is temporarily unavailable.",
        )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Explain Anything subsystem health check",
)
async def get_explain_health():
    """Verify Explain Anything subsystem readiness."""
    return {
        "status": "ready",
        "subsystem": "explain_anything",
        "supportedModes": [mode.value for mode in ExplanationMode],
        "sanitizationEnforced": True,
        "fallbackSupported": True,
    }
