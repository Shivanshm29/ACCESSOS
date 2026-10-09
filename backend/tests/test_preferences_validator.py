"""
Tests for ACCESSOS User Preferences Validator & Sanitizer (Phase 10)
"""

from app.preferences.validator import (
    get_default_preferences,
    validate_and_sanitize_preferences,
    apply_preference_update,
    contains_disallowed_keys,
)
from app.preferences.schemas import (
    UserPreferences,
    PreferenceUpdateRequest,
    LanguageCode,
    ExplanationComplexity,
    ConfirmationVerbosity,
)


def test_get_default_preferences():
    defs = get_default_preferences()
    assert isinstance(defs, UserPreferences)
    assert defs.language == LanguageCode.EN
    assert defs.guidedShowWhy is True


def test_contains_disallowed_keys_detects_credentials():
    assert contains_disallowed_keys({"password": "secret"}) is True
    assert contains_disallowed_keys({"user_token": "abc"}) is True
    assert contains_disallowed_keys({"document_content": "binary"}) is True
    assert contains_disallowed_keys({"language": "en", "highContrast": True}) is False


def test_validate_and_sanitize_falls_back_on_sensitive_keys():
    malicious = {
        "language": "hi",
        "secret_token": "evil_payload",
    }
    # Sensitive keys trigger immediate safe fallback to default preferences
    result = validate_and_sanitize_preferences(malicious)
    assert result.language == LanguageCode.EN  # Fell back safely to defaults
    assert not hasattr(result, "secret_token")


def test_validate_and_sanitize_per_field_recovery():
    corrupted = {
        "language": "hi",  # valid
        "explanationMode": "INVALID_MODE",  # invalid
        "highContrast": True,  # valid
        "largerText": "not_a_bool",  # invalid
    }
    result = validate_and_sanitize_preferences(corrupted)
    assert result.language == LanguageCode.HI
    assert result.explanationMode == ExplanationComplexity.STANDARD  # Recovered to default
    assert result.highContrast is True
    assert result.largerText is False  # Recovered to default


def test_apply_preference_update():
    current = get_default_preferences()
    update = PreferenceUpdateRequest(
        language=LanguageCode.HI,
        explanationMode=ExplanationComplexity.DETAILED,
        highContrast=True,
    )
    updated = apply_preference_update(current, update)
    assert updated.language == LanguageCode.HI
    assert updated.explanationMode == ExplanationComplexity.DETAILED
    assert updated.highContrast is True
    assert updated.guidedShowWhy is True  # Preserved
