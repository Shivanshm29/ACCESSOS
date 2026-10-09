"""
ACCESSOS Privacy-Safe Audit Logger (Phase 11)
Maintains minimal, strictly non-sensitive audit records for security events.
Never records passwords, tokens, full document text, or raw PII.
"""

import logging
import uuid
from typing import List, Optional, Any, Dict
from app.security.constants import DataClassification
from app.security.schemas import SecurityAuditEvent
from app.security.sanitizer import sanitize_data_structure

logger = logging.getLogger("accessos.security.audit")

# Bounded in-memory audit store for local inspection
MAX_AUDIT_STORE_SIZE: int = 200
_audit_store: List[SecurityAuditEvent] = []


def clean_for_logging(data: Any) -> Any:
    """
    Scrubs and bounds any data structure to ensure it contains
    zero HIGHLY_SENSITIVE credentials prior to log emission.
    """
    return sanitize_data_structure(data)


def record_security_event(
    feature: str,
    event_name: str,
    status: str,
    reason: Optional[str] = None,
    duration_ms: Optional[float] = None,
    classification: DataClassification = DataClassification.INTERNAL,
) -> SecurityAuditEvent:
    """
    Records a structured, privacy-safe security audit event.
    Logs to standard Python logging without sensitive payloads.
    """
    # Sanitize reason if present to prevent accidental data leaks
    safe_reason = None
    if reason:
        # Strip credentials and truncate reason to 150 chars
        safe_reason = str(clean_for_logging(reason))[:150]

    event = SecurityAuditEvent(
        eventId=f"audit-{uuid.uuid4().hex[:12]}",
        feature=feature,
        eventName=event_name,
        status=status,
        reason=safe_reason,
        durationMs=round(duration_ms, 2) if duration_ms is not None else None,
        classification=classification,
    )

    # In-memory bounded buffer
    _audit_store.append(event)
    if len(_audit_store) > MAX_AUDIT_STORE_SIZE:
        _audit_store.pop(0)

    # Standard log output (safe metadata only)
    logger.info(
        f"[AUDIT] {event.feature} | {event.eventName} | {event.status} "
        f"{f'| reason={event.reason}' if event.reason else ''} "
        f"{f'| duration={event.durationMs}ms' if event.durationMs is not None else ''}"
    )

    return event


def get_audit_log(limit: int = 50) -> List[SecurityAuditEvent]:
    """Returns the most recent security audit events."""
    return list(_audit_store[-limit:])


def clear_audit_log() -> None:
    """Clears audit events (used for test isolation)."""
    global _audit_store
    _audit_store = []
