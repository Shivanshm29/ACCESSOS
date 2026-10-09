"""Tests for Phase 8 Safe Interaction Policy Engine."""

import pytest
from app.interaction.schemas import (
    ActionType,
    RiskLevel,
    InteractionIntent,
    IntentSource,
    ValueSource,
    ValidateIntentRequest,
)
from app.interaction.policy import InteractionPolicyEngine
from app.interaction.validator import validate_interaction_intent


def test_blocked_actions_check():
    """Verify strictly blocked action names are detected."""
    assert InteractionPolicyEngine.is_blocked_action("SUBMIT") is True
    assert InteractionPolicyEngine.is_blocked_action("NAVIGATE") is True
    assert InteractionPolicyEngine.is_blocked_action("DELETE") is True
    assert InteractionPolicyEngine.is_blocked_action("PURCHASE") is True
    assert InteractionPolicyEngine.is_blocked_action("TYPE") is False
    assert InteractionPolicyEngine.is_blocked_action("FOCUS") is False


def test_sensitive_field_type_action_strictly_blocked():
    """Verify TYPE action into sensitive fields is strictly BLOCKED."""
    intent = InteractionIntent(
        actionId="act-pwd-1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-password",
        value="SecretPassword123",
    )

    # 1. Flagged via isSensitiveField
    req1 = ValidateIntentRequest(intent=intent, isSensitiveField=True)
    resp1 = validate_interaction_intent(req1)
    assert resp1.valid is False
    assert resp1.blocked is True
    assert resp1.riskLevel == RiskLevel.BLOCKED
    assert "sensitive" in resp1.blockedReason.lower()

    # 2. Flagged via fieldType (otp / token / cvv / card)
    for sensitive_type in ["password", "otp", "token", "cvv", "credit_card", "pin"]:
        req2 = ValidateIntentRequest(intent=intent, fieldType=sensitive_type)
        resp2 = validate_interaction_intent(req2)
        assert resp2.blocked is True
        assert resp2.riskLevel == RiskLevel.BLOCKED


def test_focus_and_highlight_allowed_on_sensitive_fields():
    """Verify FOCUS and HIGHLIGHT are permitted on sensitive fields to guide the user visually."""
    intent_focus = InteractionIntent(
        actionId="act-focus-pwd",
        actionType=ActionType.FOCUS,
        targetElementId="accessos-field-password",
    )
    req = ValidateIntentRequest(intent=intent_focus, isSensitiveField=True, fieldType="password")
    resp = validate_interaction_intent(req)
    assert resp.valid is True
    assert resp.blocked is False
    assert resp.riskLevel == RiskLevel.LOW
    assert resp.requiresConfirmation is False


def test_mutating_actions_require_confirmation():
    """Verify TYPE, SELECT_OPTION, and TOGGLE_CHECKBOX always require confirmation."""
    # TYPE
    intent_type = InteractionIntent(
        actionId="act-t1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-name",
        value="Rahul",
        valueSource=ValueSource.USER_EXPLICIT,
    )
    resp_type = validate_interaction_intent(ValidateIntentRequest(intent=intent_type))
    assert resp_type.valid is True
    assert resp_type.requiresConfirmation is True
    assert resp_type.riskLevel == RiskLevel.LOW

    # SELECT_OPTION
    intent_select = InteractionIntent(
        actionId="act-s1",
        actionType=ActionType.SELECT_OPTION,
        targetElementId="accessos-field-category",
        optionValue="OBC",
    )
    resp_select = validate_interaction_intent(ValidateIntentRequest(intent=intent_select))
    assert resp_select.valid is True
    assert resp_select.requiresConfirmation is True

    # TOGGLE_CHECKBOX
    intent_cb = InteractionIntent(
        actionId="act-c1",
        actionType=ActionType.TOGGLE_CHECKBOX,
        targetElementId="accessos-field-agree",
        checked=True,
    )
    resp_cb = validate_interaction_intent(ValidateIntentRequest(intent=intent_cb))
    assert resp_cb.valid is True
    assert resp_cb.requiresConfirmation is True


def test_missing_values_rejected():
    """Verify mutating actions with missing required parameters are rejected."""
    # TYPE with empty value
    intent_empty = InteractionIntent(
        actionId="act-err-1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-name",
        value="",
    )
    resp_empty = validate_interaction_intent(ValidateIntentRequest(intent=intent_empty))
    assert resp_empty.valid is False

    # SELECT_OPTION with missing optionValue
    intent_no_opt = InteractionIntent(
        actionId="act-err-2",
        actionType=ActionType.SELECT_OPTION,
        targetElementId="accessos-field-select",
    )
    resp_no_opt = validate_interaction_intent(ValidateIntentRequest(intent=intent_no_opt))
    assert resp_no_opt.valid is False

    # TOGGLE_CHECKBOX with missing checked
    intent_no_check = InteractionIntent(
        actionId="act-err-3",
        actionType=ActionType.TOGGLE_CHECKBOX,
        targetElementId="accessos-field-cb",
    )
    resp_no_check = validate_interaction_intent(ValidateIntentRequest(intent=intent_no_check))
    assert resp_no_check.valid is False


def test_type_action_requires_user_explicit_provenance():
    """Verify TYPE action with missing or NONE provenance is rejected."""
    intent_no_prov = InteractionIntent(
        actionId="act-prov-1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-name",
        value="Rahul",
        valueSource=ValueSource.NONE,
    )
    resp = validate_interaction_intent(ValidateIntentRequest(intent=intent_no_prov))
    assert resp.valid is False
    assert resp.blocked is True
    assert resp.riskLevel == RiskLevel.BLOCKED
    assert "provenance" in resp.blockedReason.lower()


def test_ai_suggestion_cannot_forge_user_explicit():
    """Verify an AI intent cannot forge USER_EXPLICIT provenance."""
    intent_forged = InteractionIntent(
        actionId="act-forge-1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-name",
        value="ForgedName",
        valueSource=ValueSource.USER_EXPLICIT,
        source=IntentSource.AI_SUGGESTION,
    )
    resp = validate_interaction_intent(ValidateIntentRequest(intent=intent_forged))
    assert resp.valid is False
    assert resp.blocked is True
    assert resp.riskLevel == RiskLevel.BLOCKED
    assert "forge" in resp.blockedReason.lower()


def test_type_action_rejects_ai_generated_value():
    """Verify TYPE action with AI_GENERATED provenance is strictly BLOCKED."""
    intent_ai = InteractionIntent(
        actionId="act-ai-val-1",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-name",
        value="Hallucinated Name",
        valueSource=ValueSource.AI_GENERATED,
        source=IntentSource.AI_SUGGESTION,
    )
    resp = validate_interaction_intent(ValidateIntentRequest(intent=intent_ai))
    assert resp.valid is False
    assert resp.blocked is True
    assert resp.riskLevel == RiskLevel.BLOCKED
    assert "ai-generated" in resp.blockedReason.lower() or "provenance" in resp.blockedReason.lower()

