"""
ACCESSOS Deterministic Completion Checker Engine (Phase 12)
Authoritative, non-mutating evaluation of workflow completion and requirements.
"""

import time
from typing import Dict, Any, List, Optional
from app.completion.schemas import (
    CompletionResult,
    CompletionStatus,
    CompletionRequirement,
    RequirementType,
    RequirementSeverity,
    DocumentRequirementStatus,
)
from app.completion.consistency import evaluate_cross_field_consistency
from app.completion.stages import evaluate_stage_summaries, PORTAL_STAGES


def evaluate_completion(
    page_representation: Dict[str, Any],
    form_values: Optional[Dict[str, Any]] = None,
    document_matches: Optional[List[Dict[str, Any]]] = None,
    current_stage_index: int = 0,
) -> CompletionResult:
    """
    Deterministically computes application completion without executing browser mutations.
    Sensitive values are never exposed or returned.
    """
    form_values = form_values or {}
    document_matches = document_matches or []
    fields = page_representation.get("fields", [])
    errors = page_representation.get("errors", [])
    forms = page_representation.get("forms", [])

    if len(fields) == 0 and len(forms) == 0 and len(document_matches) == 0:
        return CompletionResult(
            overall_status=CompletionStatus.COMPLETION_UNSUPPORTED,
            completion_percent=0,
            current_stage_index=0,
            current_stage_name="",
            blocking_issues=[],
            warnings=[],
            completed_requirements=[],
            remaining_requirements=[],
            stage_summaries=[],
            document_requirements=[],
            consistency_checks=[],
            timestamp=int(time.time() * 1000),
            evaluated_field_count=0,
            evaluated_document_count=0,
        )

    # Map errors by field ID
    errors_by_field: Dict[str, List[str]] = {}
    for err in errors:
        fid = err.get("fieldId") or err.get("field_id")
        text = err.get("text", "Validation error")
        if fid:
            errors_by_field.setdefault(fid, []).append(text)

    # Build fields map for consistency checks (safe values only)
    fields_map: Dict[str, Dict[str, Any]] = {}
    for f in fields:
        fid = f.get("id") or f.get("name")
        fname = f.get("name") or fid
        is_sensitive = bool(f.get("sensitive", False))
        
        # Read value if available in form_values or representation
        val = form_values.get(fid) if fid in form_values else form_values.get(fname)
        if val is None and f.get("hasValue"):
            val = "[POPULATED]"

        # Do NOT record actual sensitive credential values in fields_map
        if is_sensitive:
            safe_val = "[SENSITIVE_PRESENT]" if val else None
        else:
            safe_val = val

        fields_map[fname] = {
            "id": fid,
            "name": fname,
            "value": safe_val,
            "sensitive": is_sensitive,
        }

    requirements: List[CompletionRequirement] = []
    evaluated_field_count = 0

    # 1. Evaluate Field Requirements
    for field in fields:
        evaluated_field_count += 1
        field_id = field.get("id", "")
        field_name = field.get("name") or field_id
        field_label = field.get("label") or field_name or "Required Field"
        is_required = bool(field.get("required", False))
        is_sensitive = bool(field.get("sensitive", False))
        section_id = field.get("sectionId") or field.get("section_id")

        # Determine if field has value (from form_values or representation.hasValue)
        provided_val = form_values.get(field_id) if field_id in form_values else form_values.get(field_name)
        has_val = bool(provided_val) or bool(field.get("hasValue", False))

        field_errors = (
            errors_by_field.get(field_id)
            or errors_by_field.get(field_name)
            or (field.get("elementId") and errors_by_field.get(field["elementId"]))
            or []
        )

        req_id = f"req-field-{field_name}"

        # Status determination
        if field_errors:
            status = CompletionStatus.INVALID
            severity = RequirementSeverity.BLOCKING
            reason = f"Validation error: {field_errors[0]}"
            next_step = f"Correct the input in {field_label} to resolve validation error."
            is_blocking = True
        elif is_required and not has_val:
            status = CompletionStatus.INCOMPLETE
            severity = RequirementSeverity.BLOCKING
            reason = f"Required field '{field_label}' is missing or empty."
            next_step = f"Enter the required information in {field_label}."
            is_blocking = True
        elif is_required and has_val:
            status = CompletionStatus.COMPLETE
            severity = RequirementSeverity.INFO
            reason = f"Required field '{field_label}' is populated."
            next_step = f"{field_label} is complete."
            is_blocking = False
        else:
            # Optional field
            status = CompletionStatus.COMPLETE if has_val else CompletionStatus.INCOMPLETE
            severity = RequirementSeverity.INFO
            reason = f"Optional field '{field_label}' is {'populated' if has_val else 'not entered'}."
            next_step = f"Optionally complete {field_label}."
            is_blocking = False

        requirements.append(
            CompletionRequirement(
                id=req_id,
                type=RequirementType.REQUIRED_FIELD if is_required else RequirementType.VALIDATION,
                title=field_label,
                description=f"Field requirement for {field_label} in stage {section_id or 'form'}.",
                status=status,
                severity=severity,
                target_element_id=field_id,
                stage_id=section_id,
                reason=reason,
                suggested_next_step=next_step,
                is_blocking=is_blocking,
                sensitive=is_sensitive,
            )
        )

    # 2. Evaluate Document Requirements
    doc_requirement_statuses: List[DocumentRequirementStatus] = []
    evaluated_doc_count = 0

    for doc_match in document_matches:
        evaluated_doc_count += 1
        req_id = doc_match.get("requirementId") or doc_match.get("requirement_id") or f"doc-req-{evaluated_doc_count}"
        doc_type = doc_match.get("documentType") or doc_match.get("document_type") or "DOCUMENT"
        title = doc_match.get("title") or f"{doc_type} Verification"
        match_status = doc_match.get("matchStatus") or doc_match.get("match_status") or "NO_MATCH"
        doc_id = doc_match.get("documentId") or doc_match.get("document_id")
        doc_name = doc_match.get("documentName") or doc_match.get("document_name")
        confidence = doc_match.get("confidence")
        evidence = doc_match.get("evidence")

        # Filename alone is strictly disallowed from satisfying requirement
        filename_only = bool(doc_match.get("filenameOnlyMatch", False))

        if match_status == "MATCH" and not filename_only:
            status = CompletionStatus.COMPLETE
            is_satisfied = True
            is_blocking = False
            reason = f"Document evidence matches requirement for {title}."
            next_step = f"{title} verification complete."
        elif match_status == "PARTIAL_MATCH":
            status = CompletionStatus.INCOMPLETE
            is_satisfied = False
            is_blocking = True
            reason = f"Document partially matches requirement for {title}. Missing complete evidence."
            next_step = f"Review document {doc_name or title} and upload a full certificate."
        elif match_status == "AMBIGUOUS":
            status = CompletionStatus.BLOCKED
            is_satisfied = False
            is_blocking = True
            reason = f"Document evidence for {title} is ambiguous and requires human verification."
            next_step = f"Review ambiguous evidence in {doc_name or title} and re-upload if needed."
        elif match_status == "NOT_ENOUGH_EVIDENCE" or filename_only:
            status = CompletionStatus.INCOMPLETE
            is_satisfied = False
            is_blocking = True
            reason = f"Insufficient evidence in document to satisfy requirement for {title}."
            next_step = f"Provide a complete, legible copy of {title}."
        else:
            status = CompletionStatus.BLOCKED
            is_satisfied = False
            is_blocking = True
            reason = f"No matching document provided for required {title}."
            next_step = f"Select and provide the required document for {title}."

        doc_status_item = DocumentRequirementStatus(
            requirement_id=req_id,
            document_type=doc_type,
            title=title,
            match_status=match_status,
            document_id=doc_id,
            document_name=doc_name,
            confidence=confidence,
            evidence=evidence,
            reason=reason,
            suggested_next_step=next_step,
            is_satisfied=is_satisfied,
            is_blocking=is_blocking,
        )
        doc_requirement_statuses.append(doc_status_item)

        # Also register as a CompletionRequirement
        requirements.append(
            CompletionRequirement(
                id=f"req-doc-{req_id}",
                type=RequirementType.REQUIRED_DOCUMENT,
                title=title,
                description=f"Supporting document requirement for {title}.",
                status=status,
                severity=RequirementSeverity.BLOCKING if is_blocking else RequirementSeverity.INFO,
                related_document_id=doc_id,
                stage_id="sec-documents",
                reason=reason,
                evidence=evidence,
                suggested_next_step=next_step,
                is_blocking=is_blocking,
            )
        )

    # 3. Evaluate Consistency Checks
    consistency_results = evaluate_cross_field_consistency(fields_map)
    for c_res in consistency_results:
        if c_res.status == "INCONSISTENT":
            requirements.append(
                CompletionRequirement(
                    id=f"req-cons-{c_res.rule_id}",
                    type=RequirementType.CONSISTENCY,
                    title=c_res.rule_name,
                    description=c_res.explanation,
                    status=CompletionStatus.INVALID if c_res.is_blocking else CompletionStatus.INCOMPLETE,
                    severity=RequirementSeverity.BLOCKING if c_res.is_blocking else RequirementSeverity.WARNING,
                    target_element_id=c_res.field_ids[0] if c_res.field_ids else None,
                    reason=c_res.explanation,
                    suggested_next_step="Align the inconsistent fields before submitting.",
                    is_blocking=c_res.is_blocking,
                )
            )

    # 4. Partition Requirements
    blocking_issues = [r for r in requirements if r.is_blocking and r.status != CompletionStatus.COMPLETE]
    warnings = [r for r in requirements if not r.is_blocking and r.status != CompletionStatus.COMPLETE]
    completed_reqs = [r for r in requirements if r.status == CompletionStatus.COMPLETE]
    remaining_reqs = [r for r in requirements if r.status != CompletionStatus.COMPLETE]

    # 5. Deterministic Overall Status
    if any(r.status == CompletionStatus.INVALID for r in blocking_issues):
        overall_status = CompletionStatus.INVALID
    elif any(r.status == CompletionStatus.BLOCKED for r in blocking_issues):
        overall_status = CompletionStatus.BLOCKED
    elif len(blocking_issues) > 0:
        overall_status = CompletionStatus.INCOMPLETE
    else:
        overall_status = CompletionStatus.COMPLETE

    total_count = len(requirements)
    completed_count = len(completed_reqs)
    completion_percent = round((completed_count / total_count) * 100) if total_count > 0 else 100

    # 6. Evaluate Stage Summaries
    stage_summaries = evaluate_stage_summaries(requirements, PORTAL_STAGES)
    stage_name = PORTAL_STAGES[current_stage_index]["name"] if 0 <= current_stage_index < len(PORTAL_STAGES) else ""

    return CompletionResult(
        overall_status=overall_status,
        completion_percent=completion_percent,
        current_stage_index=current_stage_index,
        current_stage_name=stage_name,
        blocking_issues=blocking_issues,
        warnings=warnings,
        completed_requirements=completed_reqs,
        remaining_requirements=remaining_reqs,
        stage_summaries=stage_summaries,
        document_requirements=doc_requirement_statuses,
        consistency_checks=consistency_results,
        timestamp=int(time.time() * 1000),
        evaluated_field_count=evaluated_field_count,
        evaluated_document_count=evaluated_doc_count,
    )
