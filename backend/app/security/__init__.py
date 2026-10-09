"""
ACCESSOS Security Package (Phase 11)
Centralized security, sanitization, privacy audit, and boundary enforcement.
"""

from app.security.constants import (
    DataClassification,
    SecurityErrorCode,
    SECURITY_VERSION,
    MAX_PAYLOAD_BYTES,
    MAX_PROMPT_CHARS,
    MAX_AI_RESPONSE_CHARS,
    MAX_STRING_LENGTH,
    REDACTION_PASSWORD,
    REDACTION_TOKEN,
    REDACTION_OTP,
    REDACTION_CVV,
    REDACTION_CARD,
    REDACTION_BANK,
    REDACTION_GOV_ID,
    REDACTION_PATH,
)
from app.security.schemas import (
    SecurityAuditEvent,
    SafeErrorResponse,
    NetworkDestination,
    SecurityValidationResult,
)
from app.security.sanitizer import (
    sanitize_text,
    strip_html,
    redact_sensitive_credentials,
    sanitize_url,
    classify_data,
    sanitize_data_structure,
)
from app.security.audit import (
    record_security_event,
    get_audit_log,
    clear_audit_log,
    clean_for_logging,
)
from app.security.policies import (
    can_send_to_ai,
    can_persist,
    can_log,
    is_allowed_network_destination,
    get_network_destinations,
    is_secure_cors_origin,
)
from app.security.validators import (
    detect_prompt_injection,
    wrap_untrusted_content,
    validate_ai_output,
    validate_message_payload,
)

__all__ = [
    "DataClassification",
    "SecurityErrorCode",
    "SECURITY_VERSION",
    "MAX_PAYLOAD_BYTES",
    "MAX_PROMPT_CHARS",
    "MAX_AI_RESPONSE_CHARS",
    "MAX_STRING_LENGTH",
    "REDACTION_PASSWORD",
    "REDACTION_TOKEN",
    "REDACTION_OTP",
    "REDACTION_CVV",
    "REDACTION_CARD",
    "REDACTION_BANK",
    "REDACTION_GOV_ID",
    "REDACTION_PATH",
    "SecurityAuditEvent",
    "SafeErrorResponse",
    "NetworkDestination",
    "SecurityValidationResult",
    "sanitize_text",
    "strip_html",
    "redact_sensitive_credentials",
    "sanitize_url",
    "classify_data",
    "sanitize_data_structure",
    "record_security_event",
    "get_audit_log",
    "clear_audit_log",
    "clean_for_logging",
    "can_send_to_ai",
    "can_persist",
    "can_log",
    "is_allowed_network_destination",
    "get_network_destinations",
    "is_secure_cors_origin",
    "detect_prompt_injection",
    "wrap_untrusted_content",
    "validate_ai_output",
    "validate_message_payload",
]
