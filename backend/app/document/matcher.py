"""Document to Page Requirement Matching Engine (Phase 9).

Compares extracted document facts and classification against webpage form requirements.
Performs semantic requirement matching, mismatch detection (e.g., mismatched names),
and surfaces clear ambiguity warnings without automatically mutating the browser.
"""

from typing import List, Optional
from app.document.schemas import (
    DocumentClassification,
    DocumentRepresentation,
    DocumentRequirementMatch,
    DocumentType,
    ExtractedFact,
    FactType,
    MatchStatus,
    PageRequirement,
)
from app.document.sanitization import truncate_evidence


def _names_match(name1: str, name2: str) -> bool:
    """Case-insensitive fuzzy token matching for applicant names."""
    if not name1 or not name2:
        return False
    tokens1 = set(name1.lower().replace(".", "").split())
    tokens2 = set(name2.lower().replace(".", "").split())
    # Match if tokens have significant overlap (e.g., "Devansh Varma" vs "Devansh Varma")
    intersection = tokens1.intersection(tokens2)
    return len(intersection) >= min(len(tokens1), len(tokens2)) and len(intersection) > 0


def match_document_to_requirements(
    doc: DocumentRepresentation,
    facts: List[ExtractedFact],
    requirements: List[PageRequirement],
) -> List[DocumentRequirementMatch]:
    """Match an analyzed document against a list of webpage requirements.
    
    Generates grounded matches with clear confidence and surfaces mismatches
    (e.g., account holder name differing from webpage applicant).
    """
    matches: List[DocumentRequirementMatch] = []
    doc_type = doc.documentType.category

    # Pre-index extracted facts for quick lookup
    facts_by_type: dict[FactType, List[ExtractedFact]] = {}
    for f in facts:
        facts_by_type.setdefault(f.factType, []).append(f)

    for req in requirements:
        req_id = req.requirementId
        desc = req.description
        target_field = req.targetFieldId
        expected_type = req.expectedDocumentType
        expected_values = req.expectedValues or {}

        # 1. Handle Corrupt / Password-Protected / Unreadable Documents
        if not doc.extractedTextAvailable or doc.pageCount == 0:
            matches.append(
                DocumentRequirementMatch(
                    requirementId=req_id,
                    requirementDescription=desc,
                    documentId=doc.documentId,
                    matchStatus=MatchStatus.NOT_ENOUGH_EVIDENCE,
                    confidence=0.0,
                    evidence="",
                    reason="Document text could not be extracted or is unreadable; cannot verify requirement.",
                    suggestedUploadFieldId=target_field,
                    warnings=["Unreadable document content"],
                )
            )
            continue

        # 2. Check Document Type Alignment
        type_aligned = False
        if expected_type and expected_type != DocumentType.UNKNOWN:
            type_aligned = (doc_type == expected_type)
        else:
            # Infer from requirement description or field id
            desc_lower = (desc + " " + (target_field or "")).lower()
            if "income" in desc_lower and doc_type == DocumentType.INCOME_CERTIFICATE:
                type_aligned = True
            elif ("marksheet" in desc_lower or "academic" in desc_lower or "transcript" in desc_lower) and doc_type == DocumentType.ACADEMIC_MARKSHEET:
                type_aligned = True
            elif ("domicile" in desc_lower or "residence" in desc_lower) and doc_type == DocumentType.DOMICILE_CERTIFICATE:
                type_aligned = True
            elif ("bank" in desc_lower or "passbook" in desc_lower or "account" in desc_lower) and doc_type == DocumentType.BANK_DOCUMENT:
                type_aligned = True
            elif ("identity" in desc_lower or "aadhaar" in desc_lower or "voter" in desc_lower or "passport" in desc_lower) and doc_type == DocumentType.IDENTITY_DOCUMENT:
                type_aligned = True
            elif ("declaration" in desc_lower or "affirm" in desc_lower) and doc_type == DocumentType.DECLARATION:
                type_aligned = True

        # If document type does NOT align with expected requirement
        if not type_aligned:
            # Check if this requirement is specific to another document type
            if expected_type and expected_type != doc_type and doc_type != DocumentType.UNKNOWN:
                matches.append(
                    DocumentRequirementMatch(
                        requirementId=req_id,
                        requirementDescription=desc,
                        documentId=doc.documentId,
                        matchStatus=MatchStatus.NO_MATCH,
                        confidence=0.1,
                        evidence=doc.documentType.evidence or "",
                        reason=f"Document type ({doc_type.value}) does not match required type ({expected_type.value}).",
                        suggestedUploadFieldId=target_field,
                        warnings=[],
                    )
                )
                continue

            # If document type is UNKNOWN and no facts support it (DOC-16: filename alone is not enough!)
            if doc_type == DocumentType.UNKNOWN:
                matches.append(
                    DocumentRequirementMatch(
                        requirementId=req_id,
                        requirementDescription=desc,
                        documentId=doc.documentId,
                        matchStatus=MatchStatus.NOT_ENOUGH_EVIDENCE,
                        confidence=0.2,
                        evidence="",
                        reason="Document content contains insufficient evidence to classify or verify this requirement.",
                        suggestedUploadFieldId=target_field,
                        warnings=["Document content unverified"],
                    )
                )
                continue

        # 3. Document Type Aligns — Evaluate Supporting Facts & Values
        match_status = MatchStatus.MATCH
        confidence = min(0.92, doc.documentType.confidence + 0.1)
        evidence_snippet = doc.documentType.evidence or ""
        reasons: List[str] = [f"Document identified as {doc_type.value.replace('_', ' ').title()}."]
        warnings: List[str] = []

        # 4. Value Consistency & Mismatch Verification (e.g. Bank Account Holder vs Applicant Name)
        expected_applicant_name = expected_values.get("applicant_name") or expected_values.get("applicant_full_name")
        if expected_applicant_name:
            # Check bank holder name if bank document
            if doc_type == DocumentType.BANK_DOCUMENT:
                holder_facts = facts_by_type.get(FactType.BANK_ACCOUNT_HOLDER, [])
                if holder_facts:
                    holder_name = holder_facts[0].value
                    if not _names_match(expected_applicant_name, holder_name):
                        match_status = MatchStatus.AMBIGUOUS
                        confidence = 0.45
                        warning_msg = (
                            f"Name mismatch detected: Webpage applicant name is '{expected_applicant_name}', "
                            f"but bank document shows holder '{holder_name}'."
                        )
                        warnings.append(warning_msg)
                        reasons.append(warning_msg)
                        evidence_snippet = holder_facts[0].evidence
                    else:
                        reasons.append(f"Account holder '{holder_name}' matches webpage applicant name.")
                        evidence_snippet = holder_facts[0].evidence

            # Check applicant name on marksheet or certificate
            elif doc_type in (DocumentType.ACADEMIC_MARKSHEET, DocumentType.INCOME_CERTIFICATE, DocumentType.DOMICILE_CERTIFICATE):
                app_facts = facts_by_type.get(FactType.APPLICANT_NAME, [])
                if app_facts:
                    doc_app_name = app_facts[0].value
                    if not _names_match(expected_applicant_name, doc_app_name):
                        match_status = MatchStatus.AMBIGUOUS
                        confidence = 0.45
                        warning_msg = (
                            f"Name discrepancy: Webpage applicant name is '{expected_applicant_name}', "
                            f"but document mentions candidate '{doc_app_name}'."
                        )
                        warnings.append(warning_msg)
                        reasons.append(warning_msg)
                        evidence_snippet = app_facts[0].evidence
                    else:
                        reasons.append(f"Candidate name '{doc_app_name}' matches applicant.")
                        evidence_snippet = app_facts[0].evidence

        # Check Income requirement details if present
        if doc_type == DocumentType.INCOME_CERTIFICATE:
            inc_facts = facts_by_type.get(FactType.INCOME_AMOUNT, [])
            if inc_facts:
                reasons.append(f"Verified stated income figure: {inc_facts[0].value}.")
                if not evidence_snippet:
                    evidence_snippet = inc_facts[0].evidence

        # Check Marksheet details
        if doc_type == DocumentType.ACADEMIC_MARKSHEET:
            marks_facts = facts_by_type.get(FactType.PERCENTAGE_MARKS, []) or facts_by_type.get(FactType.GRADE_OR_CGPA, [])
            if marks_facts:
                reasons.append(f"Extracted academic qualification metric: {marks_facts[0].value}.")
                if not evidence_snippet:
                    evidence_snippet = marks_facts[0].evidence

        # Build recommendation
        full_reason = " ".join(reasons)
        matches.append(
            DocumentRequirementMatch(
                requirementId=req_id,
                requirementDescription=desc,
                documentId=doc.documentId,
                matchStatus=match_status,
                confidence=round(confidence, 3),
                evidence=truncate_evidence(evidence_snippet),
                reason=full_reason,
                suggestedUploadFieldId=target_field,
                warnings=warnings,
            )
        )

    return matches
