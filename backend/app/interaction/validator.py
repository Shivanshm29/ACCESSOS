"""ACCESSOS Interaction Intent Validator (Phase 8).

Validates proposed interaction requests against schema constraints and policy rules.
"""

from app.interaction.schemas import (
    ValidateIntentRequest,
    ValidateIntentResponse,
    RiskLevel,
)
from app.interaction.policy import InteractionPolicyEngine


def validate_interaction_intent(request: ValidateIntentRequest) -> ValidateIntentResponse:
    """Validate an interaction intent against policies and return a structured decision."""
    intent = request.intent

    valid, risk_level, requires_confirmation, blocked_reason = InteractionPolicyEngine.evaluate_intent(
        intent=intent,
        is_sensitive_field=request.isSensitiveField,
        field_type=request.fieldType,
    )

    # Sync calculated values back to intent
    intent.riskLevel = risk_level
    intent.requiresConfirmation = requires_confirmation

    blocked = risk_level == RiskLevel.BLOCKED or not valid

    return ValidateIntentResponse(
        valid=valid,
        intent=intent,
        riskLevel=risk_level,
        requiresConfirmation=requires_confirmation,
        blocked=blocked,
        blockedReason=blocked_reason,
    )
