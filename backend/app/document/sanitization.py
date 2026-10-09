"""Privacy sanitization and safety utilities for Document Intelligence (Phase 9).

Ensures sensitive personal data from documents is not leaked to ordinary logs,
enforces truncation bounds, and prevents path traversal in document identifiers.
"""

import re
from typing import Optional
from app.document.constants import MAX_EVIDENCE_LENGTH


# Regex patterns for sensitive data redaction
_AADHAAR_PATTERN = re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")
_CARD_PATTERN = re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b")
_ACCOUNT_NUM_PATTERN = re.compile(r"\b\d{9,18}\b")
_PASSWORD_TOKEN_PATTERN = re.compile(r"(?i)(password|secret|token|otp|cvv)\s*[:=]\s*(\S+)")


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and strip illegal characters."""
    if not filename:
        return "unnamed_document"
    # Strip directory components (Windows and POSIX)
    cleaned = filename.replace("\\", "/").split("/")[-1]
    # Remove null bytes and control chars
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", cleaned)
    # Remove path traversal tokens
    cleaned = cleaned.replace("..", "")
    return cleaned.strip() or "unnamed_document"


def truncate_evidence(text: str, max_length: int = MAX_EVIDENCE_LENGTH) -> str:
    """Truncate evidence text to strict bounded snippet length."""
    if not text:
        return ""
    # Normalize whitespaces
    normalized = " ".join(text.split())
    if len(normalized) <= max_length:
        return normalized
    return normalized[: max_length - 3] + "..."


def redact_sensitive_value(value: str) -> str:
    """Redact or mask sensitive values for safe logging/display."""
    if not value:
        return ""
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 8:
        # Mask all but the last 4 digits
        return f"****{digits[-4:]}"
    # General mask for shorter values
    if len(value) <= 4:
        return "****"
    return value[:2] + "****" + value[-2:]


def sanitize_for_logging(text: str) -> str:
    """Sanitize document text so it can never leak personal data into system logs."""
    if not text:
        return ""
    redacted = _CARD_PATTERN.sub("[CARD-REDACTED]", text)
    redacted = _AADHAAR_PATTERN.sub("[ID-REDACTED]", redacted)
    redacted = _PASSWORD_TOKEN_PATTERN.sub(r"\1: [REDACTED]", redacted)
    # Mask raw account numbers
    redacted = _ACCOUNT_NUM_PATTERN.sub("[ACCOUNT-REDACTED]", redacted)
    return redacted
