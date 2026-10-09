"""Tests for Phase 7 Explain Anything Pydantic schemas."""
import pytest
from pydantic import ValidationError
from app.explain.schemas import (
    ExplanationMode,
    ExplainSelectionContext,
    ExplainAnythingRequest,
    TermDefinition,
    ExplainAnythingResponse,
)


def test_explanation_mode_enum_values():
    assert ExplanationMode.SIMPLE.value == "SIMPLE"
    assert ExplanationMode.DETAILED.value == "DETAILED"
    assert ExplanationMode.PLAIN_LANGUAGE.value == "PLAIN_LANGUAGE"
    assert ExplanationMode.EXAMPLE.value == "EXAMPLE"
    assert ExplanationMode.KEY_POINTS.value == "KEY_POINTS"


def test_explanation_mode_normalization():
    # Test case insensitivity and aliases
    req1 = ExplainAnythingRequest(selectedText="test text", mode="simple")
    assert req1.mode == ExplanationMode.SIMPLE

    req2 = ExplainAnythingRequest(selectedText="test text", mode="concise")
    assert req2.mode == ExplanationMode.SIMPLE

    req3 = ExplainAnythingRequest(selectedText="test text", mode="in-depth")
    assert req3.mode == ExplanationMode.DETAILED

    req4 = ExplainAnythingRequest(selectedText="test text", mode="plain")
    assert req4.mode == ExplanationMode.PLAIN_LANGUAGE

    req5 = ExplainAnythingRequest(selectedText="test text", mode="scenario")
    assert req5.mode == ExplanationMode.EXAMPLE

    req6 = ExplainAnythingRequest(selectedText="test text", mode="bullets")
    assert req6.mode == ExplanationMode.KEY_POINTS


def test_explain_selection_context_bounds():
    ctx = ExplainSelectionContext(
        pageTitle="Scholarship Portal",
        sectionHeading="Stage 1",
        targetElementId="accessos-field-001",
        contextBefore="Preceding text",
        contextAfter="Subsequent text",
        elementRole="label",
    )
    assert ctx.pageTitle == "Scholarship Portal"
    assert ctx.targetElementId == "accessos-field-001"

    # Context length limits
    with pytest.raises(ValidationError):
        ExplainSelectionContext(contextBefore="A" * 600)


def test_explain_request_validation():
    # Empty selected text rejected
    with pytest.raises(ValidationError):
        ExplainAnythingRequest(selectedText="")

    # Max length 1000
    with pytest.raises(ValidationError):
        ExplainAnythingRequest(selectedText="x" * 1005)

    valid_req = ExplainAnythingRequest(
        selectedText="Statutory Quota Sub-allocation",
        mode=ExplanationMode.SIMPLE,
    )
    assert valid_req.selectedText == "Statutory Quota Sub-allocation"
    assert valid_req.mode == ExplanationMode.SIMPLE


def test_explain_response_schema():
    resp = ExplainAnythingResponse(
        explanation="This is a simple explanation.",
        whyItMatters="It affects your eligibility.",
        keyPoints=["Point 1", "Point 2"],
        terminology=[
            TermDefinition(term="Statutory", definition="Required by official law.")
        ],
        example="For instance, a state reserving 15% of grants.",
        confidence=0.95,
        sourceSummary="Direct explanation of supplied terms.",
        warnings=[],
        mode=ExplanationMode.SIMPLE,
        provider="mock",
        model="mock-v1",
        fallbackUsed=False,
    )
    assert resp.explanation == "This is a simple explanation."
    assert len(resp.terminology) == 1
    assert resp.terminology[0].term == "Statutory"
    assert resp.confidence == 0.95
    assert not resp.fallbackUsed
