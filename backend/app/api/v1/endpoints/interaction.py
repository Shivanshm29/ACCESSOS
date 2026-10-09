"""ACCESSOS Interaction Engine API Endpoints (Phase 8).

Validates structured interaction proposals and enforces safety policies.
Browser execution is strictly handled in the extension; the backend acts
as a security policy gate and validation authority.
"""

from fastapi import APIRouter, HTTPException, status
from app.interaction.schemas import (
    ValidateIntentRequest,
    ValidateIntentResponse,
)
from app.interaction.validator import validate_interaction_intent

router = APIRouter(prefix="/interaction")


@router.get("/health", status_code=status.HTTP_200_OK)
async def interaction_health() -> dict:
    """Health check for Safe Interaction Engine."""
    return {
        "status": "ready",
        "service": "safe-interaction-engine",
        "phase": 8,
    }


@router.post("/validate", response_model=ValidateIntentResponse, status_code=status.HTTP_200_OK)
async def validate_intent_endpoint(request: ValidateIntentRequest) -> ValidateIntentResponse:
    """Validate a structured interaction proposal against allowlists, policy, and sensitive data protections."""
    try:
        decision = validate_interaction_intent(request)
        return decision
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interaction intent: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error evaluating interaction intent: {str(e)}",
        )
