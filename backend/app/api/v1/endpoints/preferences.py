"""
ACCESSOS User Preferences API Endpoints (Phase 10)
Provides endpoints for retrieving defaults and validating client preference updates.
"""

from fastapi import APIRouter, HTTPException, status
from app.preferences.schemas import (
    UserPreferences,
    PreferenceUpdateRequest,
    PreferenceResponse,
    PreferenceHealthResponse,
)
from app.preferences.validator import (
    get_default_preferences,
    apply_preference_update,
    contains_disallowed_keys,
)
from app.preferences.constants import PREFERENCES_VERSION, SUPPORTED_LANGUAGES

router = APIRouter(prefix="/preferences", tags=["User Preferences"])


@router.get("/health", response_model=PreferenceHealthResponse)
def get_preferences_health() -> PreferenceHealthResponse:
    """Returns preference service status and supported languages."""
    return PreferenceHealthResponse(
        status="ok",
        version=PREFERENCES_VERSION,
        supportedLanguages=sorted(list(SUPPORTED_LANGUAGES)),
    )


@router.get("/defaults", response_model=PreferenceResponse)
def get_preferences_defaults() -> PreferenceResponse:
    """Returns the default safe configuration for user preferences."""
    defaults = get_default_preferences()
    return PreferenceResponse(
        preferences=defaults,
        status="success",
        message="Default preferences retrieved successfully",
    )


@router.post("/validate", response_model=PreferenceResponse)
def validate_preferences(request: PreferenceUpdateRequest) -> PreferenceResponse:
    """
    Validates a proposed user preference update against strict schemas.
    Rejects sensitive keys and unknown fields.
    """
    req_dict = request.model_dump(exclude_unset=True)
    if contains_disallowed_keys(req_dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Preferences cannot contain sensitive keys or credentials.",
        )

    current_defaults = get_default_preferences()
    updated = apply_preference_update(current_defaults, request)
    return PreferenceResponse(
        preferences=updated,
        status="success",
        message="Preferences validated successfully",
    )
