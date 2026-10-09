"""Unit tests for Document Intelligence schemas (Phase 9)."""

import pytest
from pydantic import ValidationError
from app.document.schemas import (
    DocumentType,
    FactType,
    FactSensitivity,
    MatchStatus,
    ExtractedFact,
    DocumentClassification,
    DocumentRepresentation,
    PageRequirement,
    DocumentRequirementMatch,
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
)


def test_document_type_enums():
    assert DocumentType.ACADEMIC_MARKSHEET == "ACADEMIC_MARKSHEET"
    assert DocumentType.INCOME_CERTIFICATE == "INCOME_CERTIFICATE"
    assert DocumentType.BANK_DOCUMENT == "BANK_DOCUMENT"
    assert DocumentType.DOMICILE_CERTIFICATE == "DOMICILE_CERTIFICATE"
    assert DocumentType.IDENTITY_DOCUMENT == "IDENTITY_DOCUMENT"
    assert DocumentType.UNKNOWN == "UNKNOWN"


def test_extracted_fact_confidence_clamping():
    fact = ExtractedFact(
        factType=FactType.APPLICANT_NAME,
        value="Devansh Varma",
        confidence=1.5,  # Clamped to 1.0
        sourcePage=1,
        evidence="Name of Candidate: Devansh Varma",
        sensitivity=FactSensitivity.NON_SENSITIVE,
    )
    assert fact.confidence == 1.0
    assert fact.value == "Devansh Varma"


def test_extracted_fact_negative_confidence():
    fact = ExtractedFact(
        factType=FactType.INCOME_AMOUNT,
        value="Rs. 1,50,000",
        confidence=-0.5,  # Clamped to 0.0
        sourcePage=1,
        evidence="Income: Rs. 1,50,000",
        sensitivity=FactSensitivity.SENSITIVE,
    )
    assert fact.confidence == 0.0


def test_document_classification_defaults():
    classification = DocumentClassification(
        category=DocumentType.INCOME_CERTIFICATE,
        confidence=0.88,
        reason="Detected Revenue Officer and annual income statements",
        evidence="Annual Income: Rs. 1,50,000",
    )
    assert classification.category == DocumentType.INCOME_CERTIFICATE
    assert classification.confidence == 0.88


def test_document_representation_schema():
    doc = DocumentRepresentation(
        documentId="doc_12345",
        filename="income_cert.pdf",
        mimeType="application/pdf",
        pageCount=1,
        extractedTextAvailable=True,
    )
    assert doc.documentId == "doc_12345"
    assert doc.pageCount == 1
    assert doc.documentType.category == DocumentType.UNKNOWN


def test_requirement_match_schema():
    match = DocumentRequirementMatch(
        requirementId="req_income_proof",
        requirementDescription="Upload Annual Income Certificate",
        documentId="doc_12345",
        matchStatus=MatchStatus.MATCH,
        confidence=0.92,
        evidence="Annual Income: Rs. 1,80,000/- per annum",
        reason="Document verified as Income Certificate.",
        suggestedUploadFieldId="doc_income_certificate",
    )
    assert match.matchStatus == MatchStatus.MATCH
    assert match.confidence == 0.92
    assert match.suggestedUploadFieldId == "doc_income_certificate"
