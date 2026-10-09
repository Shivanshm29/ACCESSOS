"""Tests for Phase 8 Safe Interaction Engine Schemas."""

import pytest
from pydantic import ValidationError
from app.interaction.schemas import (
    ActionType,
    RiskLevel,
    IntentSource,
    ValueSource,
    InteractionStatus,
    InteractionIntent,
    InteractionResult,
    ValidateIntentRequest,
    ValidateIntentResponse,
)


def test_action_type_allowlist():
    """Verify only allowlisted actions are defined."""
    assert ActionType.FOCUS == "FOCUS"
    assert ActionType.TYPE == "TYPE"
    assert ActionType.SELECT_OPTION == "SELECT_OPTION"
    assert ActionType.TOGGLE_CHECKBOX == "TOGGLE_CHECKBOX"
    assert ActionType.HIGHLIGHT == "HIGHLIGHT"
    assert ActionType.CLEAR_HIGHLIGHT == "CLEAR_HIGHLIGHT"

    # Verify invalid action type raises validation error
    with pytest.raises(ValueError):
        ActionType("SUBMIT")
    with pytest.raises(ValueError):
        ActionType("EXECUTE_JS")


def test_valid_interaction_intent():
    """Verify standard valid interaction intent passes validation."""
    intent = InteractionIntent(
        actionId="act-001",
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-first-name",
        value="Jane",
        valueSource=ValueSource.USER_EXPLICIT,
        reason="Required applicant first name",
        riskLevel=RiskLevel.LOW,
        requiresConfirmation=True,
        source=IntentSource.GUIDED_MODE,
    )
    assert intent.actionId == "act-001"
    assert intent.actionType == ActionType.TYPE
    assert intent.targetElementId == "accessos-field-first-name"
    assert intent.value == "Jane"
    assert intent.requiresConfirmation is True


def test_target_element_id_rejects_css_selectors():
    """Verify arbitrary CSS selectors are strictly rejected."""
    bad_targets = [
        "input#first-name",
        ".applicant-field",
        "div > input",
        "form input[name='first_name']",
        "input:focus",
        "div+p",
        "input~label",
    ]
    for target in bad_targets:
        with pytest.raises(ValidationError):
            InteractionIntent(
                actionId="act-test",
                actionType=ActionType.TYPE,
                targetElementId=target,
                value="Test",
            )


def test_target_element_id_rejects_xpath_and_scripts():
    """Verify XPath expressions and script injections in target IDs are rejected."""
    bad_targets = [
        "//input[@id='name']",
        "/html/body/form/input",
        "<script>alert(1)</script>",
        "javascript:void(0)",
        "accessos-field; drop table;",
    ]
    for target in bad_targets:
        with pytest.raises(ValidationError):
            InteractionIntent(
                actionId="act-test",
                actionType=ActionType.TYPE,
                targetElementId=target,
                value="Test",
            )


def test_value_rejects_executable_scripts():
    """Verify executable code inside TYPE values is rejected."""
    bad_values = [
        "<script>alert('pwned')</script>",
        "javascript:alert(1)",
        "eval('hack()')",
        "new Function('return 1')()",
    ]
    for val in bad_values:
        with pytest.raises(ValidationError):
            InteractionIntent(
                actionId="act-test",
                actionType=ActionType.TYPE,
                targetElementId="accessos-field-name",
                value=val,
            )


def test_interaction_result_schema():
    """Verify InteractionResult schema and fields."""
    res = InteractionResult(
        actionId="act-123",
        status=InteractionStatus.SUCCESS,
        actionType=ActionType.TYPE,
        targetElementId="accessos-field-first-name",
        message="Typed value successfully verified in target",
        changed=True,
        requiresConfirmation=True,
    )
    assert res.status == InteractionStatus.SUCCESS
    assert res.changed is True
    assert res.timestamp > 0
