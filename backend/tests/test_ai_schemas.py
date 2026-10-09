"""Tests for Phase 5 AI Pydantic schemas and validations."""
import pytest
from pydantic import ValidationError
from app.schemas.ai_analysis import (
    PageType,
    AIBarrierType,
    AISeverity,
    PageUnderstanding,
    ProcessUnderstanding,
    AIBarrierFinding,
    NextAction,
    AIPageAnalysisResponse,
    AIPageAnalysisRequest,
)


def test_page_type_enum():
    """Verify supported PageType enum values."""
    assert PageType.APPLICATION.value == "APPLICATION"
    assert PageType.INFORMATION.value == "INFORMATION"
    assert PageType.REGISTRATION.value == "REGISTRATION"
    assert PageType.PAYMENT.value == "PAYMENT"
    assert PageType.DOCUMENT_SUBMISSION.value == "DOCUMENT_SUBMISSION"
    assert PageType.OTHER.value == "OTHER"


def test_ai_barrier_types():
    """Verify controlled AI barrier categories."""
    assert AIBarrierType.UNFAMILIAR_TERM.value == "UNFAMILIAR_TERM"
    assert AIBarrierType.LANGUAGE_COMPLEXITY.value == "LANGUAGE_COMPLEXITY"
    assert AIBarrierType.COGNITIVE_LOAD.value == "COGNITIVE_LOAD"
    assert AIBarrierType.PROCESS_COMPLEXITY.value == "PROCESS_COMPLEXITY"
    assert AIBarrierType.REQUIREMENT_CLARITY.value == "REQUIREMENT_CLARITY"
    assert AIBarrierType.NEXT_ACTION_UNCLEAR.value == "NEXT_ACTION_UNCLEAR"


def test_critical_severity_downgraded_to_high():
    """Per Phase 5 rules, AI findings must never have CRITICAL severity."""
    finding = AIBarrierFinding(
        id="finding-1",
        type=AIBarrierType.UNFAMILIAR_TERM,
        severity="CRITICAL",  # should be downgraded to HIGH
        title="Institutional jargon",
        explanation="Uses complex statutory citation.",
        evidence=[{"kind": "text", "value": "Domicile Cadre"}],
        affectedElementIds=["accessos-inst-1"],
        suggestedSimplification="Use plain language.",
        confidence=0.9,
    )
    assert finding.severity == AISeverity.HIGH


def test_ai_barrier_finding_invalid_confidence():
    """Confidence must be bounded between 0.0 and 1.0."""
    with pytest.raises(ValidationError):
        AIBarrierFinding(
            id="finding-1",
            type=AIBarrierType.UNFAMILIAR_TERM,
            severity=AISeverity.MEDIUM,
            title="Title",
            explanation="Explanation",
            evidence=[],
            affectedElementIds=[],
            suggestedSimplification="Suggestion",
            confidence=1.5,  # Invalid
        )


def test_ai_page_analysis_response_schema():
    """Verify complete response serialization and deserialization."""
    resp_data = {
        "pageUnderstanding": {
            "pageType": "APPLICATION",
            "pagePurpose": "Scholarship application portal",
            "confidence": 0.95,
        },
        "processUnderstanding": {
            "processName": "Scholarship Application",
            "goal": "Submit credentials and application",
            "currentStage": "Personal Information",
            "totalStages": 8,
            "majorStages": ["Personal Info", "Academic Records", "Documents"],
            "requiredInformationCategories": ["Contact", "Income"],
            "requiredDocumentCategories": ["Transcripts"],
            "likelyNextAction": "Fill out personal details",
        },
        "barriers": [
            {
                "id": "ai-1",
                "type": "UNFAMILIAR_TERM",
                "severity": "HIGH",
                "title": "Complex terminology",
                "explanation": "Statutory citations are unclear.",
                "evidence": [{"kind": "instruction", "text": "Section 4-A"}],
                "affectedElementIds": ["accessos-inst-1"],
                "suggestedSimplification": "Clarify Section 4-A",
                "confidence": 0.9,
            }
        ],
        "nextAction": {
            "description": "Complete applicant details",
            "targetElementId": "accessos-field-1",
            "stage": "Personal Info",
        },
        "summary": "Application form with 8 stages and moderate complexity.",
        "provider": "mock",
        "model": "mock-v1",
        "durationMs": 42.5,
        "truncated": False,
        "truncationNotes": [],
    }

    response = AIPageAnalysisResponse.model_validate(resp_data)
    assert response.pageUnderstanding.pageType == PageType.APPLICATION
    assert len(response.barriers) == 1
    assert response.barriers[0].severity == AISeverity.HIGH
    assert response.nextAction.targetElementId == "accessos-field-1"


def test_ai_page_analysis_request_schema():
    """Verify incoming request validation."""
    req = AIPageAnalysisRequest(
        page={"title": "Test Page", "url": "https://example.com/apply"},
        representation={"fields": []},
        accessibilityReport={"score": {"finalScore": 55}},
        userGoal="Apply for scholarship",
    )
    assert req.page["title"] == "Test Page"
    assert req.userGoal == "Apply for scholarship"
