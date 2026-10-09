"""Unit tests for Guided Mode grounding and element ID validation."""
from app.guided.schemas import ActionType, GuidedStep
from app.guided.validation import (
    extract_valid_element_ids,
    validate_and_ground_steps,
)


def test_extract_valid_element_ids():
    """Verify all categories of elements are indexed into the valid IDs set."""
    rep = {
        "fields": [
            {"id": "f-1", "accessosId": "accessos-field-001"},
            {"id": "f-2", "accessosId": "accessos-field-002"},
        ],
        "sections": [
            {"id": "accessos-section-001"},
        ],
        "buttons": [
            {"id": "b-1", "accessosId": "accessos-button-001"},
        ],
        "links": [
            {"id": "accessos-link-001"},
        ],
        "instructions": [
            {"id": "accessos-inst-001"},
        ],
        "headings": [
            {"id": "accessos-heading-001"},
        ],
    }

    valid_ids = extract_valid_element_ids(rep)
    assert "accessos-field-001" in valid_ids
    assert "accessos-field-002" in valid_ids
    assert "accessos-section-001" in valid_ids
    assert "accessos-button-001" in valid_ids
    assert "accessos-link-001" in valid_ids
    assert "accessos-inst-001" in valid_ids
    assert "accessos-heading-001" in valid_ids


def test_grounding_rejects_invented_element_ids():
    """
    CRITICAL GROUNDING TEST (Section 5):
    Verifies that invented or hallucinated element IDs are safely stripped (set to None)
    and logged in warnings rather than mapped to unrelated elements.
    """
    rep = {
        "fields": [
            {"accessosId": "accessos-field-001"},
        ],
    }

    steps = [
        GuidedStep(
            stepId="step-1",
            order=1,
            title="Valid Step",
            description="Enter first name",
            targetElementId="accessos-field-001",  # VALID
            actionType=ActionType.ENTER,
            whyItMatters="Identity",
        ),
        GuidedStep(
            stepId="step-2",
            order=2,
            title="Hallucinated Step",
            description="Enter non-existent ID",
            targetElementId="hallucinated-fake-input-999",  # INVALID
            actionType=ActionType.ENTER,
            whyItMatters="Does not exist",
        ),
        GuidedStep(
            stepId="step-3",
            order=3,
            title="Overview Step",
            description="General instruction",
            targetElementId=None,  # Intentionally None
            actionType=ActionType.REVIEW,
            whyItMatters="Orientation",
        ),
    ]

    validated_steps, warnings = validate_and_ground_steps(steps, rep)

    # Step 1: Valid target retained
    assert validated_steps[0].targetElementId == "accessos-field-001"

    # Step 2: Hallucinated target safely nullified
    assert validated_steps[1].targetElementId is None
    assert len(warnings) == 1
    assert "hallucinated-fake-input-999" in warnings[0]

    # Step 3: None target remains None
    assert validated_steps[2].targetElementId is None
