"""Unit tests for Guided Mode orchestrator and fallback engine."""
import pytest
from app.guided.schemas import GuidedModeStartRequest, ActionType
from app.guided.orchestrator import GuidedModeOrchestrator, load_guided_prompts
from app.guided.fallback import DeterministicGuidedFallbackGenerator


@pytest.mark.asyncio
async def test_mock_guided_mode_generation_stage_0():
    """Verify Mock Guided Mode produces grounded Stage 1 steps."""
    orchestrator = GuidedModeOrchestrator()
    rep = {
        "fields": [
            {"accessosId": "accessos-field-001", "type": "text", "label": "First Name"},
            {"accessosId": "accessos-field-002", "type": "text", "label": "Last Name"},
            {"accessosId": "accessos-field-003", "type": "date", "label": "Date of Birth"},
            {"accessosId": "accessos-field-004", "type": "text", "label": "Alternate Contact"},
        ],
        "sections": [
            {"id": "accessos-section-001", "title": "Applicant Primary Information"},
        ],
    }

    req = GuidedModeStartRequest(
        page={"title": "National Student Scholarship Application"},
        representation=rep,
        targetStageIndex=0,
    )

    response = await orchestrator.start_guided_mode(req)

    assert response.currentStage == "Applicant Primary Information"
    assert response.totalStages == 8
    assert response.progressPercent == 0.0
    assert len(response.steps) >= 3
    assert response.steps[0].actionType == ActionType.ENTER
    assert response.steps[0].targetElementId == "accessos-field-001"
    assert response.steps[0].required is True


@pytest.mark.asyncio
async def test_deterministic_fallback_generator():
    """Verify fallback engine generates valid, grounded steps from representation alone."""
    rep = {
        "fields": [
            {"accessosId": "accessos-field-010", "type": "file", "label": "Income Certificate", "required": True},
            {"accessosId": "accessos-field-011", "type": "select", "label": "Category", "required": True},
        ],
        "sections": [
            {"id": "accessos-section-002", "title": "Documentation Section", "fieldIds": ["accessos-field-010", "accessos-field-011"]},
        ],
    }

    response = DeterministicGuidedFallbackGenerator.generate_guidance(
        page_meta={"title": "Custom Application"},
        representation=rep,
        accessibility_report={"findings": [{"affectedElementId": "accessos-field-010", "title": "Missing description"}]},
        target_stage_index=0,
    )

    assert response.fallbackUsed is True
    assert len(response.steps) == 2
    assert response.steps[0].actionType == ActionType.UPLOAD
    assert response.steps[0].targetElementId == "accessos-field-010"
    assert "Missing description" in (response.steps[0].barrierNote or "")
    assert response.steps[1].actionType == ActionType.SELECT


def test_guided_prompts_safety_and_rules():
    """Verify system prompt enforces non-automation and grounding rules."""
    sys_prompt, user_prompt = load_guided_prompts()
    assert "NEVER INVENT PAGE ELEMENTS" in sys_prompt
    assert "NEVER INVENT ELEMENT IDs" in sys_prompt
    assert "HUMAN ACTIONS ONLY" in sys_prompt
    assert "ABSOLUTE PRIVACY" in sys_prompt
    assert "ZERO CODE GENERATION" in sys_prompt
    assert "NO WCAG CLAIMS" in sys_prompt
    assert "{stage_instruction}" in user_prompt
    assert "{sanitized_page_json}" in user_prompt
