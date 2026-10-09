"""
ACCESSOS Security API Endpoints (Phase 11)
Endpoints for security health, egress network destination inventory,
privacy-safe audit logs, and sanitization validation.
"""

from fastapi import APIRouter, Body
from typing import Dict, Any, List
from app.security import (
    SECURITY_VERSION,
    get_network_destinations,
    get_audit_log,
    record_security_event,
    sanitize_text,
    sanitize_data_structure,
    detect_prompt_injection,
    NetworkDestination,
    SecurityAuditEvent,
    DataClassification,
)

router = APIRouter(prefix="/security", tags=["Security & Privacy"])


@router.get("/health")
def security_health() -> Dict[str, Any]:
    """Health check endpoint for centralized security system."""
    record_security_event(
        feature="security",
        event_name="health_check",
        status="SUCCESS",
        reason="Health check probe verified",
    )
    return {
        "status": "healthy",
        "system": "ACCESSOS Security & Privacy Layer",
        "version": SECURITY_VERSION,
        "classificationModel": ["PUBLIC", "INTERNAL", "PERSONAL", "SENSITIVE", "HIGHLY_SENSITIVE"],
        "invariantsEnforced": [
            "AI_IS_UNTRUSTED",
            "PHASE8_ONLY_MUTATION_AUTHORITY",
            "USER_EXPLICIT_PROVENANCE_REQUIRED",
            "SENSITIVE_FIELDS_BLOCKED",
            "SUBMISSION_BLOCKED",
            "AUTOMATIC_UPLOAD_BLOCKED",
            "ZERO_SENSITIVE_PERSISTENCE",
            "PRIVACY_SAFE_LOGGING",
        ],
    }


@router.get("/destinations", response_model=List[NetworkDestination])
def get_destinations() -> List[NetworkDestination]:
    """Returns the inventory of authorized egress network destinations."""
    return get_network_destinations()


@router.get("/audit", response_model=List[SecurityAuditEvent])
def get_recent_audits(limit: int = 50) -> List[SecurityAuditEvent]:
    """Returns recent privacy-safe security audit records."""
    return get_audit_log(limit=limit)


@router.post("/sanitize")
def sanitize_payload(
    payload: Dict[str, Any] = Body(...),
) -> Dict[str, Any]:
    """
    Validates and sanitizes a structured payload, redacting credentials
    and checking for prompt injection markers.
    """
    text_content = payload.get("text", "")
    has_injection = detect_prompt_injection(text_content) if isinstance(text_content, str) else False
    sanitized_data = sanitize_data_structure(payload)

    return {
        "sanitized": sanitized_data,
        "promptInjectionDetected": has_injection,
        "version": SECURITY_VERSION,
    }
