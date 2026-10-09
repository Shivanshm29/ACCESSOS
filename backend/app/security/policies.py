"""
ACCESSOS Security & Data-Flow Policies (Phase 11)
Enforces data boundaries for AI egress, persistence, logging, and network origins.
"""

from typing import List
from app.security.constants import (
    DataClassification,
    ALLOWLISTED_AI_HOSTS,
    ALLOWLISTED_LOCAL_HOSTS,
)
from app.security.schemas import NetworkDestination


def can_send_to_ai(classification: DataClassification) -> bool:
    """
    Determines whether a data classification may be transmitted to external AI providers.
    HIGHLY_SENSITIVE data is strictly barred from AI egress.
    """
    if classification == DataClassification.HIGHLY_SENSITIVE:
        return False
    return True


def can_persist(classification: DataClassification) -> bool:
    """
    Determines whether data may be stored in local extension or backend storage.
    HIGHLY_SENSITIVE data (passwords, tokens, OTPs, CVVs) must NEVER be persisted.
    """
    if classification == DataClassification.HIGHLY_SENSITIVE:
        return False
    return True


def can_log(classification: DataClassification) -> bool:
    """
    Determines whether data may appear in standard system logs.
    SENSITIVE and HIGHLY_SENSITIVE values must be redacted or excluded.
    """
    if classification in (DataClassification.HIGHLY_SENSITIVE, DataClassification.SENSITIVE):
        return False
    return True


def is_allowed_network_destination(host: str) -> bool:
    """
    Checks if an outbound network host is in the strict egress allowlist.
    Prevents unauthorized telemetry or communication with arbitrary endpoints.
    """
    if not host or not isinstance(host, str):
        return False

    clean_host = host.strip().lower()
    # Strip port if present
    if ":" in clean_host:
        clean_host = clean_host.split(":")[0]

    return clean_host in ALLOWLISTED_AI_HOSTS or clean_host in ALLOWLISTED_LOCAL_HOSTS


def get_network_destinations() -> List[NetworkDestination]:
    """Returns the comprehensive inventory of documented network endpoints."""
    destinations = [
        NetworkDestination(
            name="local-backend",
            host="localhost",
            purpose="ACCESSOS local backend server for processing and analysis",
            isEgress=False,
            requiresApiKey=False,
        ),
        NetworkDestination(
            name="openai",
            host="api.openai.com",
            purpose="Optional external LLM provider for assistance and explanations",
            isEgress=True,
            requiresApiKey=True,
        ),
        NetworkDestination(
            name="gemini",
            host="generativelanguage.googleapis.com",
            purpose="Optional external Google Gemini provider for assistance",
            isEgress=True,
            requiresApiKey=True,
        ),
        NetworkDestination(
            name="openrouter",
            host="openrouter.ai",
            purpose="Optional external OpenRouter multi-model LLM provider",
            isEgress=True,
            requiresApiKey=True,
        ),
    ]
    return destinations


def is_secure_cors_origin(origin: str, allowed_origins: List[str]) -> bool:
    """
    Validates CORS origin against allowlist.
    Strictly forbids wildcard '*' when credentials are used.
    """
    if not origin or origin == "*":
        return False

    origin_lower = origin.strip().lower()

    for pattern in allowed_origins:
        pattern_lower = pattern.strip().lower()
        if pattern_lower == "*":
            continue
        if pattern_lower.endswith("*"):
            prefix = pattern_lower[:-1]
            if origin_lower.startswith(prefix):
                return True
        elif origin_lower == pattern_lower:
            return True

    return False
