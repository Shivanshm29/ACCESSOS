"""
ACCESSOS Preferences Validator & Sanitizer (Phase 10)
Ensures strict bounds, sanitization against sensitive properties, and safe default fallback.
"""

import logging
from typing import Any, Dict
from pydantic import ValidationError
from app.preferences.schemas import (
    UserPreferences,
    PreferenceUpdateRequest,
    LanguageCode,
    ExplanationComplexity,
    ConfirmationVerbosity,
)
from app.preferences.constants import (
    DISALLOWED_PREFERENCE_KEYWORDS,
    PREFERENCES_VERSION,
    ALLOWED_PREFERENCE_KEYS,
)

logger = logging.getLogger(__name__)


def get_default_preferences() -> UserPreferences:
    """Returns a fresh instance of default user preferences."""
    return UserPreferences()


def contains_disallowed_keys(data: Dict[str, Any]) -> bool:
    """Checks if any dictionary key contains disallowed sensitive terms."""
    for key in data.keys():
        if key in ALLOWED_PREFERENCE_KEYS:
            continue
        key_lower = str(key).lower()
        for kw in DISALLOWED_PREFERENCE_KEYWORDS:
            if kw in key_lower:
                return True
    return False


def validate_and_sanitize_preferences(raw_data: Any) -> UserPreferences:
    """
    Safely validates a raw dictionary into a UserPreferences model.
    If the data is corrupted, malformed, contains sensitive keys, or fails validation,
    it falls back safely to default preferences without raising an exception.
    """
    if not isinstance(raw_data, dict):
        logger.warning("Preferences data is not a dict; falling back to safe defaults.")
        return get_default_preferences()

    # Reject if sensitive keys are attempted
    if contains_disallowed_keys(raw_data):
        logger.warning("Disallowed sensitive keys detected in preferences; rejecting and falling back to defaults.")
        return get_default_preferences()

    try:
        return UserPreferences.model_validate(raw_data)
    except ValidationError as err:
        logger.warning(f"Preferences validation error: {err}. Attempting per-field safe recovery.")

        # Per-field recovery: extract valid fields, substitute defaults for invalid fields
        defaults = get_default_preferences().model_dump()
        recovered: Dict[str, Any] = {}

        for field_name, default_val in defaults.items():
            if field_name not in raw_data:
                recovered[field_name] = default_val
                continue

            candidate = raw_data[field_name]
            # Try setting candidate; if invalid, keep default
            if field_name == "language":
                recovered[field_name] = candidate if candidate in {"en", "hi"} else default_val
            elif field_name == "explanationMode":
                recovered[field_name] = candidate if candidate in {"SIMPLE", "STANDARD", "DETAILED"} else default_val
            elif field_name == "confirmationVerbosity":
                recovered[field_name] = candidate if candidate in {"STANDARD", "DETAILED"} else default_val
            elif isinstance(default_val, bool):
                recovered[field_name] = candidate if isinstance(candidate, bool) else default_val
            elif field_name == "version":
                recovered[field_name] = candidate if isinstance(candidate, int) and candidate >= 1 else PREFERENCES_VERSION
            else:
                recovered[field_name] = default_val

        try:
            return UserPreferences.model_validate(recovered)
        except Exception:
            return get_default_preferences()


def apply_preference_update(
    current: UserPreferences,
    update: PreferenceUpdateRequest,
) -> UserPreferences:
    """
    Applies validated partial updates to existing preferences.
    """
    current_dict = current.model_dump()
    update_dict = update.model_dump(exclude_unset=True)

    # Merge
    current_dict.update(update_dict)
    return UserPreferences.model_validate(current_dict)
