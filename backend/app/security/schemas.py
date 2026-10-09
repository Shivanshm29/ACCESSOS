"""
ACCESSOS Security Schemas (Phase 11)
Typed audit logs, safe error contracts, and data-flow envelopes.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field
from app.security.constants import DataClassification, SecurityErrorCode, SECURITY_VERSION


class SecurityAuditEvent(BaseModel):
    """
    Privacy-safe audit log event.
    Must never contain passwords, tokens, full document bodies, or raw PII.
    """
    model_config = ConfigDict(extra="forbid")

    eventId: str = Field(description="Unique event ID")
    feature: str = Field(description="Subsystem name: ai, guided, explain, interaction, document, preferences")
    eventName: str = Field(description="Action/audit identifier")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = Field(description="SUCCESS, REJECTED, BLOCKED, or ERROR")
    reason: Optional[str] = Field(default=None, description="Coarse, non-sensitive reason code")
    durationMs: Optional[float] = Field(default=None, description="Execution duration in milliseconds")
    classification: DataClassification = Field(default=DataClassification.INTERNAL)


class SafeErrorResponse(BaseModel):
    """
    Safe structured error response.
    Never exposes stack traces, database details, local file paths, or credentials.
    """
    model_config = ConfigDict(extra="forbid")

    success: bool = Field(default=False)
    errorCode: SecurityErrorCode = Field(description="Standardized safe error code")
    message: str = Field(description="User-friendly error message")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version: int = Field(default=SECURITY_VERSION)


class NetworkDestination(BaseModel):
    """Documented egress network destination."""
    model_config = ConfigDict(extra="forbid")

    name: str = Field(description="Destination identifier (e.g., openai, gemini, local-backend)")
    host: str = Field(description="Allowed hostname")
    purpose: str = Field(description="Functional reason for network access")
    isEgress: bool = Field(default=True)
    requiresApiKey: bool = Field(default=False)


class SecurityValidationResult(BaseModel):
    """Validation result from central security analysis."""
    model_config = ConfigDict(extra="forbid")

    valid: bool
    classification: DataClassification = DataClassification.INTERNAL
    sanitized: bool = False
    violations: List[str] = Field(default_factory=list)
    sanitizedText: Optional[str] = None
