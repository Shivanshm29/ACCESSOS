"""API endpoints for Phase 6 Guided Mode."""
import logging
from fastapi import APIRouter, HTTPException, status
from app.guided.orchestrator import GuidedModeOrchestrator
from app.guided.schemas import (
    GuidedModeStartRequest,
    GuidedModeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/guided", tags=["Guided Mode"])


@router.post(
    "/start",
    response_model=GuidedModeResponse,
    status_code=status.HTTP_200_OK,
    summary="Start Guided Mode for a page or process stage",
    description="Transforms PageRepresentation, AccessibilityReport, and AI Page Analysis into grounded, step-by-step guidance.",
)
async def start_guided_mode(request: GuidedModeStartRequest) -> GuidedModeResponse:
    """Generate sequential, grounded steps for completing the webpage process."""
    orchestrator = GuidedModeOrchestrator()
    try:
        response = await orchestrator.start_guided_mode(request)
        return response
    except Exception as e:
        logger.error("Unexpected error in Guided Mode generation: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Guided Mode is temporarily unavailable.",
        )


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    summary="Guided Mode subsystem health check",
)
async def get_guided_health():
    """Verify Guided Mode subsystem readiness."""
    return {
        "status": "ready",
        "subsystem": "guided_mode",
        "groundingEnforced": True,
        "fallbackSupported": True,
    }
