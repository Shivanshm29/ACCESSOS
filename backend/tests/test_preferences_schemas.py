"""
Tests for ACCESSOS User Preferences Schemas (Phase 10)
"""

import pytest
from pydantic import ValidationError
from app.preferences.schemas import (
    UserPreferences,
    PreferenceUpdateRequest,
    LanguageCode,
    ExplanationComplexity,
    ConfirmationVerbosity,
)
from app.preferences.constants import PREFERENCES_VERSION


def test_user_preferences_default_values():
    prefs = UserPreferences()
    assert prefs.version == PREFERENCES_VERSION
    assert prefs.language == LanguageCode.EN
    assert prefs.explanationMode == ExplanationComplexity.STANDARD
    assert prefs.highContrast is False
    assert prefs.largerText is False
    assert prefs.reducedDensity is False
    assert prefs.guidedShowWhy is True
    assert prefs.guidedShowWarnings is True
    assert prefs.guidedShowProgress is True
    assert prefs.confirmationVerbosity == ConfirmationVerbosity.STANDARD
    assert prefs.documentShowEvidence is True
    assert prefs.documentShowConfidence is True


def test_user_preferences_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        UserPreferences(
            unknownField="some_value",  # Extra fields forbidden
        )


def test_user_preferences_rejects_invalid_language():
    with pytest.raises(ValidationError):
        UserPreferences(language="fr")  # Only 'en' and 'hi' allowed


def test_user_preferences_rejects_invalid_explanation_mode():
    with pytest.raises(ValidationError):
        UserPreferences(explanationMode="SUPER_SIMPLE")


def test_user_preferences_rejects_invalid_confirmation_verbosity():
    with pytest.raises(ValidationError):
        UserPreferences(confirmationVerbosity="NONE")  # Cannot disable confirmation


def test_preference_update_request_allows_partial_valid_fields():
    req = PreferenceUpdateRequest(language=LanguageCode.HI, highContrast=True)
    dumped = req.model_dump(exclude_unset=True)
    assert dumped == {"language": "hi", "highContrast": True}


def test_preference_update_request_rejects_extra_fields():
    with pytest.raises(ValidationError):
        PreferenceUpdateRequest.model_validate({"disableConfirmations": True})
