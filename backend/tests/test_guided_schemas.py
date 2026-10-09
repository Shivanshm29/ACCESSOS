"""Unit tests for Phase 6 Guided Mode Pydantic schemas."""
import pytest
from pydantic import ValidationError
from app.guided.schemas import (
    ActionType,
    GuidedStep,
    GuidedModeResponse,
    GuidedModeStartRequest,
)


def test_action_type_enum():
    """Verify supported descriptive ActionType enums."""
    assert ActionType.ENTER.value == "ENTER"
    assert ActionType.SELECT.value == "SELECT"
    assert ActionType.UPLOAD.value == "UPLOAD"
    assert ActionType.REVIEW.value == "REVIEW"
    assert ActionType.READ.value == "READ"
    assert ActionType.CONFIRM.value == "CONFIRM"
    assert ActionType.SUBMIT_REVIEW.value == "SUBMIT_REVIEW"


def test_action_type_normalization():
    """Test LLM action synonyms safely map to controlled ActionType enums."""
    step = GuidedStep(
        stepId="step-1",
        order=1,
        title="Fill Form",
        description="Enter name",
        actionType="INPUT",  # synonym for ENTER
        whyItMatters="Identity verification",
    )
    assert step.actionType == ActionType.ENTER

    step2 = GuidedStep(
        stepId="step-2",
        order=2,
        title="Attach Document",
        description="Upload file",
        actionType="ATTACH",  # synonym for UPLOAD
        whyItMatters="Proof of income",
    )
    assert step2.actionType == ActionType.UPLOAD


def test_guided_step_schema_validation():
    """Verify validation boundaries on GuidedStep."""
    # Order must be >= 1
    with pytest.raises(ValidationError):
        GuidedStep(
            stepId="step-0",
            order=0,  # Invalid
            title="Invalid",
            description="Desc",
            actionType=ActionType.READ,
            whyItMatters="Why",
        )


def test_guided_mode_response_schema():
    """Verify complete GuidedModeResponse serialization."""
    data = {
        "title": "Scholarship Guide",
        "overview": "Step-by-step guidance",
        "currentStage": "Primary Details",
        "totalStages": 8,
        "progressPercent": 12.5,
        "steps": [
            {
                "stepId": "step-001",
                "order": 1,
                "title": "First Name",
                "description": "Enter first name",
                "targetElementId": "accessos-field-001",
                "actionType": "ENTER",
                "whyItMatters": "Identity",
                "required": True,
                "completed": False,
            }
        ],
        "warnings": [],
        "completionMessage": "Stage finished.",
        "provider": "mock",
        "model": "mock-v1",
        "durationMs": 5.0,
        "fallbackUsed": False,
    }
    resp = GuidedModeResponse.model_validate(data)
    assert resp.currentStage == "Primary Details"
    assert resp.totalStages == 8
    assert len(resp.steps) == 1
    assert resp.steps[0].actionType == ActionType.ENTER


def test_guided_mode_start_request_schema():
    """Verify GuidedModeStartRequest validation."""
    req = GuidedModeStartRequest(
        page={"title": "Test Portal", "url": "http://localhost:3000"},
        representation={"fields": []},
        accessibilityReport={"score": 55},
        userGoal="Apply for grant",
        targetStageIndex=0,
    )
    assert req.page["title"] == "Test Portal"
    assert req.targetStageIndex == 0
