"""ACCESSOS Interaction Safety Policy Engine (Phase 8).

Defines the security boundaries, allowlisted rules, confirmation criteria,
and sensitive field protections for all proposed browser interactions.
"""

from typing import Tuple, Optional
from app.interaction.schemas import (
    ActionType,
    RiskLevel,
    InteractionIntent,
    IntentSource,
    ValueSource,
    BLOCKED_ACTION_STRINGS,
)

# Set of field types considered sensitive where automated typing is forbidden
SENSITIVE_FIELD_TYPES = {
    "password",
    "otp",
    "token",
    "auth",
    "secret",
    "cvv",
    "cvc",
    "credit_card",
    "card_number",
    "bank_account",
    "pin",
    "ssn",
    "security_code",
}


class InteractionPolicyEngine:
    """Evaluates proposed interaction intents against strict safety rules."""

    @classmethod
    def is_blocked_action(cls, action_name: str) -> bool:
        """Check if an action is in the forbidden actions list."""
        upper = action_name.strip().upper()
        return upper in BLOCKED_ACTION_STRINGS

    @classmethod
    def evaluate_intent(
        cls,
        intent: InteractionIntent,
        is_sensitive_field: bool = False,
        field_type: Optional[str] = None,
    ) -> Tuple[bool, RiskLevel, bool, Optional[str]]:
        """Evaluate an interaction intent for safety, confirmation, and blockage.

        Returns:
            Tuple[valid, risk_level, requires_confirmation, blocked_reason]
        """
        # 1. Check if action type is blocked
        if cls.is_blocked_action(intent.actionType.value):
            return (
                False,
                RiskLevel.BLOCKED,
                False,
                f"Action '{intent.actionType.value}' is strictly blocked in Phase 8 for security reasons.",
            )

        # 2. Check for sensitive field constraints
        is_sensitive = is_sensitive_field
        if field_type:
            clean_type = field_type.strip().lower()
            if any(s in clean_type for s in SENSITIVE_FIELD_TYPES):
                is_sensitive = True

        if is_sensitive:
            # Sensitive fields can NEVER be typed into
            if intent.actionType == ActionType.TYPE:
                return (
                    False,
                    RiskLevel.BLOCKED,
                    False,
                    "Automated data entry into sensitive fields (passwords, tokens, payment credentials) is strictly blocked.",
                )
            # FOCUS and HIGHLIGHT on sensitive fields are allowed to assist user visual location
            if intent.actionType in {ActionType.FOCUS, ActionType.HIGHLIGHT, ActionType.CLEAR_HIGHLIGHT}:
                return (True, RiskLevel.LOW, False, None)

            # Option selection or checkbox on sensitive fields requires high caution
            return (
                False,
                RiskLevel.BLOCKED,
                False,
                "Modification of sensitive fields is not permitted.",
            )

        # 3. Action-specific validation
        if intent.actionType == ActionType.TYPE:
            if intent.value is None or intent.value == "":
                return (
                    False,
                    RiskLevel.MEDIUM,
                    True,
                    "TYPE action requires an explicit, non-empty value.",
                )

            # Issue 1: Value provenance enforcement
            if intent.source == IntentSource.AI_SUGGESTION and intent.valueSource == ValueSource.USER_EXPLICIT:
                return (
                    False,
                    RiskLevel.BLOCKED,
                    False,
                    "AI suggestions cannot forge USER_EXPLICIT value provenance.",
                )

            if intent.valueSource != ValueSource.USER_EXPLICIT:
                return (
                    False,
                    RiskLevel.BLOCKED,
                    False,
                    "TYPE action rejected: mutating value must have explicit trusted user provenance (USER_EXPLICIT). AI-generated values cannot be typed.",
                )

            # Mutating action: always requires user confirmation
            return (True, RiskLevel.LOW, True, None)

        if intent.actionType == ActionType.SELECT_OPTION:
            if not intent.optionValue:
                return (
                    False,
                    RiskLevel.MEDIUM,
                    True,
                    "SELECT_OPTION requires an explicit optionValue.",
                )
            # Mutating action: always requires user confirmation
            return (True, RiskLevel.LOW, True, None)

        if intent.actionType == ActionType.TOGGLE_CHECKBOX:
            if intent.checked is None:
                return (
                    False,
                    RiskLevel.MEDIUM,
                    True,
                    "TOGGLE_CHECKBOX requires an explicit boolean target state.",
                )
            # Mutating action: always requires user confirmation
            return (True, RiskLevel.LOW, True, None)

        if intent.actionType in {ActionType.FOCUS, ActionType.HIGHLIGHT, ActionType.CLEAR_HIGHLIGHT}:
            # Read-only / visual actions: no confirmation required, low risk
            return (True, RiskLevel.LOW, False, None)

        # Default fallback: reject unrecognized
        return (
            False,
            RiskLevel.BLOCKED,
            False,
            f"Action type '{intent.actionType}' is not supported.",
        )
