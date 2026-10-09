"""
ACCESSOS User Preferences Constants (Phase 10)
Defines bounds, supported options, schema version, and security filters.
"""

from typing import Set

PREFERENCES_VERSION: int = 1

SUPPORTED_LANGUAGES: Set[str] = {"en", "hi"}

ALLOWED_PREFERENCE_KEYS: Set[str] = {
    "version",
    "language",
    "explanationMode",
    "highContrast",
    "largerText",
    "reducedDensity",
    "guidedShowWhy",
    "guidedShowWarnings",
    "guidedShowProgress",
    "confirmationVerbosity",
    "documentShowEvidence",
    "documentShowConfidence",
    "analyticsEnabled",
}

# Strict blacklist of sensitive property names that MUST NEVER be present in preferences
DISALLOWED_PREFERENCE_KEYWORDS: Set[str] = {
    "password",
    "passwd",
    "secret",
    "token",
    "auth",
    "jwt",
    "otp",
    "pin",
    "cvv",
    "cvc",
    "card",
    "account",
    "bank",
    "document_content",
    "raw_document",
    "html",
    "raw_html",
    "script",
    "code",
    "eval",
    "filesystem",
    "path",
}
