"""Deterministic Guided Mode fallback generator when AI provider is unavailable."""
import re
from typing import Any, Dict, List, Optional
from app.guided.schemas import (
    ActionType,
    GuidedStep,
    GuidedModeResponse,
)


class DeterministicGuidedFallbackGenerator:
    """Generates structured, grounded Guided Mode steps purely from local page representation."""

    @classmethod
    def generate_guidance(
        cls,
        page_meta: Dict[str, Any],
        representation: Optional[Dict[str, Any]] = None,
        accessibility_report: Optional[Dict[str, Any]] = None,
        ai_analysis: Optional[Dict[str, Any]] = None,
        target_stage_index: Optional[int] = None,
    ) -> GuidedModeResponse:
        title = page_meta.get("title", "Digital Process Guide")

        # 1. Determine stages from AI analysis or sections
        stages: List[str] = []
        if ai_analysis and "processUnderstanding" in ai_analysis:
            proc = ai_analysis["processUnderstanding"]
            stages = proc.get("majorStages", [])
            proc_name = proc.get("processName", title)
        else:
            proc_name = title

        # Fallback to sections if no AI stages exist
        sections = representation.get("sections", []) if representation else []
        if not stages and sections:
            for s in sections:
                s_title = s.get("title", "").strip()
                if s_title and not any(ign in s_title.lower() for ign in ["header", "footer", "banner", "nav"]):
                    stages.append(s_title)

        if not stages:
            stages = ["Form Information Review", "Submission"]

        total_stages = len(stages)
        stage_idx = 0
        if target_stage_index is not None and 0 <= target_stage_index < total_stages:
            stage_idx = target_stage_index

        current_stage = stages[stage_idx]
        progress_percent = round((stage_idx / total_stages) * 100, 1)

        # 2. Collect field and accessibility barriers map
        barriers_by_element: Dict[str, str] = {}
        if accessibility_report:
            for finding in accessibility_report.get("findings", []):
                elem_id = finding.get("affectedElementId")
                if elem_id:
                    barriers_by_element[elem_id] = f"Note: {finding.get('title', 'Accessibility barrier detected')}"

        if ai_analysis:
            for b in ai_analysis.get("barriers", []):
                for elem_id in b.get("affectedElementIds", []):
                    if elem_id not in barriers_by_element:
                        barriers_by_element[elem_id] = f"AI Note: {b.get('title', 'Potential usability barrier')}"

        # 3. Identify fields belonging to current stage
        steps: List[GuidedStep] = []
        target_section = None
        if sections:
            # Match section title to current stage
            for s in sections:
                if current_stage.lower() in s.get("title", "").lower() or s.get("title", "").lower() in current_stage.lower():
                    target_section = s
                    break
            if not target_section and stage_idx < len(sections):
                target_section = sections[stage_idx]

        # Extract fields from target section or page representation
        fields = representation.get("fields", []) if representation else []
        relevant_fields = []
        if target_section and target_section.get("fieldIds"):
            sec_field_ids = set(target_section.get("fieldIds", []))
            relevant_fields = [f for f in fields if (f.get("id") in sec_field_ids or f.get("accessosId") in sec_field_ids)]
        elif fields:
            relevant_fields = fields[:6]  # Progressive chunk

        if not relevant_fields and fields:
            relevant_fields = fields[:4]

        # 4. Generate sequential guided steps
        order = 1
        for field in relevant_fields:
            field_id = field.get("accessosId") or field.get("id")
            field_type = str(field.get("type", "text")).lower()
            field_label = field.get("label") or field.get("name") or f"Field {order}"
            is_required = bool(field.get("required", False))

            # Determine descriptive action type
            if field_type == "file":
                action = ActionType.UPLOAD
                step_title = f"Upload {field_label}"
                desc = f"Select and attach your required document for {field_label}."
                why = f"Required documentation to verify eligibility in this process."
            elif field_type in ["select", "radio", "checkbox"] or "options" in field:
                action = ActionType.SELECT
                step_title = f"Select {field_label}"
                desc = f"Choose the appropriate option for {field_label}."
                why = f"Captures necessary categorization for your application profile."
            else:
                action = ActionType.ENTER
                step_title = f"Enter {field_label}"
                desc = f"Fill in your {field_label} in this field."
                why = f"Essential applicant information needed for processing."

            barrier_note = barriers_by_element.get(field_id)

            steps.append(
                GuidedStep(
                    stepId=f"step-{order:03d}",
                    order=order,
                    title=step_title,
                    description=desc,
                    targetElementId=field_id,
                    actionType=action,
                    whyItMatters=why,
                    required=is_required,
                    completed=False,
                    barrierNote=barrier_note,
                )
            )
            order += 1

        # Fallback step if no fields found
        if not steps:
            steps.append(
                GuidedStep(
                    stepId="step-001",
                    order=1,
                    title=f"Review {current_stage}",
                    description=f"Carefully review the instructions and requirements in {current_stage}.",
                    targetElementId=target_section.get("id") if target_section else None,
                    actionType=ActionType.REVIEW,
                    whyItMatters="Ensures all preparatory criteria are met before continuing.",
                    required=True,
                    completed=False,
                )
            )

        overview_text = f"Step-by-step guidance for Stage {stage_idx + 1} of {total_stages}: {current_stage}."

        return GuidedModeResponse(
            title=proc_name,
            overview=overview_text,
            currentStage=current_stage,
            totalStages=total_stages,
            progressPercent=progress_percent,
            steps=steps,
            warnings=["Generated using ACCESSOS Deterministic Guidance Engine."],
            completionMessage=f"Stage '{current_stage}' review complete. Continue to the next stage when ready.",
            provider="deterministic-fallback",
            model="local-rule-engine",
            durationMs=1.5,
            fallbackUsed=True,
        )
