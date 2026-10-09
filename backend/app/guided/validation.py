"""Grounding validator ensuring Guided Mode steps only reference verified DOM element IDs."""
from typing import Any, Dict, List, Optional, Set, Tuple
from app.guided.schemas import GuidedStep


def extract_valid_element_ids(representation: Optional[Dict[str, Any]]) -> Set[str]:
    """Collect all valid ACCESSOS element IDs from a structured PageRepresentation."""
    valid_ids: Set[str] = set()
    if not representation:
        return valid_ids

    # 1. Fields
    for field in representation.get("fields", []):
        if field.get("accessosId"):
            valid_ids.add(str(field["accessosId"]))
        if field.get("id"):
            valid_ids.add(str(field["id"]))

    # 2. Sections
    for section in representation.get("sections", []):
        if section.get("id"):
            valid_ids.add(str(section["id"]))

    # 3. Buttons
    for button in representation.get("buttons", []):
        if button.get("accessosId"):
            valid_ids.add(str(button["accessosId"]))
        if button.get("id"):
            valid_ids.add(str(button["id"]))

    # 4. Links
    for link in representation.get("links", []):
        if link.get("id"):
            valid_ids.add(str(link["id"]))

    # 5. Instructions
    for inst in representation.get("instructions", []):
        if inst.get("id"):
            valid_ids.add(str(inst["id"]))

    # 6. Headings
    for heading in representation.get("headings", []):
        if heading.get("id"):
            valid_ids.add(str(heading["id"]))

    return valid_ids


def validate_and_ground_steps(
    steps: List[GuidedStep],
    representation: Optional[Dict[str, Any]],
) -> Tuple[List[GuidedStep], List[str]]:
    """
    Validates that each step's targetElementId exists in the PageRepresentation.
    If an element ID is invalid or invented by an AI:
    - Target is safely removed (set to None).
    - Validation issue is recorded in warnings.
    - Step is preserved for instruction without dangerous or broken target links.
    """
    valid_ids = extract_valid_element_ids(representation)
    validated_steps: List[GuidedStep] = []
    warnings: List[str] = []

    for step in steps:
        target = step.targetElementId
        if target:
            target_clean = str(target).strip()
            if valid_ids and target_clean not in valid_ids:
                warnings.append(
                    f"Grounding validation: Target '{target_clean}' in step '{step.title}' "
                    f"does not exist in PageRepresentation. Target link removed for user safety."
                )
                # Nullify invalid target rather than silently mapping to unrelated element
                step = step.model_copy(update={"targetElementId": None})
            else:
                step = step.model_copy(update={"targetElementId": target_clean})

        validated_steps.append(step)

    return validated_steps, warnings
