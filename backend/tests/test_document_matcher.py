"""Unit tests for Document Requirement Matcher (Phase 9).

Tests matching against webpage requirements, mismatch detection, and ambiguity handling.
"""

import pytest
from app.document.schemas import (
    DocumentClassification,
    DocumentPageRepresentation,
    DocumentRepresentation,
    DocumentType,
    ExtractedFact,
    FactSensitivity,
    FactType,
    MatchStatus,
    PageRequirement,
)
from app.document.matcher import match_document_to_requirements


def _create_test_doc(doc_type: DocumentType, text: str) -> DocumentRepresentation:
    return DocumentRepresentation(
        documentId="doc_test_match",
        filename="test_doc.pdf",
        mimeType="application/pdf",
        pageCount=1,
        extractedTextAvailable=True,
        pages=[DocumentPageRepresentation(pageNumber=1, text=text, headings=[], detectedFacts=[])],
        documentType=DocumentClassification(
            category=doc_type,
            confidence=0.90,
            reason=f"Identified as {doc_type.value}",
            evidence=text[:100],
        ),
    )


def test_match_income_certificate_to_income_requirement():
    doc = _create_test_doc(
        DocumentType.INCOME_CERTIFICATE,
        "Income Certificate. Shri Devansh Varma. Annual Income: Rs. 1,80,000",
    )
    facts = [
        ExtractedFact(
            factType=FactType.APPLICANT_NAME,
            value="Devansh Varma",
            confidence=0.90,
            sourcePage=1,
            evidence="Shri Devansh Varma",
            sensitivity=FactSensitivity.NON_SENSITIVE,
        ),
        ExtractedFact(
            factType=FactType.INCOME_AMOUNT,
            value="Rs. 1,80,000",
            confidence=0.90,
            sourcePage=1,
            evidence="Annual Income: Rs. 1,80,000",
            sensitivity=FactSensitivity.SENSITIVE,
        ),
    ]
    req = PageRequirement(
        requirementId="req_income",
        targetFieldId="doc_income_certificate",
        requirementType="FILE_UPLOAD",
        description="2. Annual Household Income Certificate",
        expectedDocumentType=DocumentType.INCOME_CERTIFICATE,
        expectedValues={"applicant_name": "Devansh Varma"},
    )

    matches = match_document_to_requirements(doc, facts, [req])
    assert len(matches) == 1
    assert matches[0].matchStatus == MatchStatus.MATCH
    assert matches[0].confidence >= 0.85
    assert matches[0].suggestedUploadFieldId == "doc_income_certificate"
    assert len(matches[0].warnings) == 0


def test_mismatch_detection_bank_account_holder():
    # Demo mismatch: Page applicant is "Devansh Varma", but Bank Document holder is "Rahul Varma"
    doc = _create_test_doc(
        DocumentType.BANK_DOCUMENT,
        "State Bank of India Passbook. Account Holder: Rahul Varma. A/c: 987654321098",
    )
    facts = [
        ExtractedFact(
            factType=FactType.BANK_ACCOUNT_HOLDER,
            value="Rahul Varma",
            confidence=0.92,
            sourcePage=1,
            evidence="Account Holder: Rahul Varma",
            sensitivity=FactSensitivity.SENSITIVE,
        ),
        ExtractedFact(
            factType=FactType.BANK_ACCOUNT_NUMBER,
            value="987654321098",
            confidence=0.95,
            sourcePage=1,
            evidence="A/c: 987654321098",
            sensitivity=FactSensitivity.HIGHLY_SENSITIVE,
        ),
    ]
    req = PageRequirement(
        requirementId="req_bank",
        targetFieldId="doc_bank_passbook",
        requirementType="FILE_UPLOAD",
        description="5. Bank Passbook / Cancelled Cheque Leaf",
        expectedDocumentType=DocumentType.BANK_DOCUMENT,
        expectedValues={"applicant_name": "Devansh Varma"},
    )

    matches = match_document_to_requirements(doc, facts, [req])
    assert len(matches) == 1
    # Must flag ambiguity / mismatch!
    assert matches[0].matchStatus == MatchStatus.AMBIGUOUS
    assert matches[0].confidence <= 0.60
    assert len(matches[0].warnings) > 0
    assert "mismatch" in matches[0].warnings[0].lower()
    assert "Rahul Varma" in matches[0].warnings[0]
    assert "Devansh Varma" in matches[0].warnings[0]


def test_incompatible_document_type_yields_no_match():
    doc = _create_test_doc(
        DocumentType.IDENTITY_DOCUMENT,
        "Election Commission of India. Voter Identity Card. Name: Devansh Varma",
    )
    req = PageRequirement(
        requirementId="req_marksheet",
        targetFieldId="doc_marksheet",
        requirementType="FILE_UPLOAD",
        description="4. Latest Qualifying Academic Marksheet",
        expectedDocumentType=DocumentType.ACADEMIC_MARKSHEET,
    )
    matches = match_document_to_requirements(doc, [], [req])
    assert len(matches) == 1
    assert matches[0].matchStatus == MatchStatus.NO_MATCH


def test_unreadable_document_yields_not_enough_evidence():
    doc = DocumentRepresentation(
        documentId="doc_corrupt",
        filename="bad.pdf",
        mimeType="application/pdf",
        pageCount=0,
        extractedTextAvailable=False,
    )
    req = PageRequirement(
        requirementId="req_income",
        targetFieldId="doc_income_certificate",
        requirementType="FILE_UPLOAD",
        description="Annual Household Income Certificate",
    )
    matches = match_document_to_requirements(doc, [], [req])
    assert len(matches) == 1
    assert matches[0].matchStatus == MatchStatus.NOT_ENOUGH_EVIDENCE
