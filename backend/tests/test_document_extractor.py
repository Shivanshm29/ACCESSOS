"""Unit tests for Document Fact Extractor (Phase 9)."""

import pytest
from app.document.schemas import (
    DocumentPageRepresentation,
    DocumentRepresentation,
    FactSensitivity,
    FactType,
)
from app.document.extractor import extract_document_facts


def test_extract_facts_grounded_in_evidence():
    text = (
        "Name of Candidate: Devansh Varma\n"
        "Institution: Mumbai State University\n"
        "Passing Year: 2025\n"
        "Percentage of Marks: 86.4%\n"
        "Annual Family Income: Rs. 1,80,000\n"
        "A/c Holder Name: Devansh Varma\n"
        "A/c Number: 123456789012\n"
        "IFSC Code: SBIN0001234\n"
        "State of Domicile: Maharashtra\n"
    )
    page = DocumentPageRepresentation(pageNumber=1, text=text, headings=[], detectedFacts=[])
    doc = DocumentRepresentation(
        documentId="doc_extract",
        filename="test.pdf",
        mimeType="application/pdf",
        pageCount=1,
        extractedTextAvailable=True,
        pages=[page],
    )

    facts = extract_document_facts(doc)
    assert len(facts) >= 6

    facts_dict = {f.factType: f for f in facts}

    # Applicant Name
    assert FactType.APPLICANT_NAME in facts_dict
    assert facts_dict[FactType.APPLICANT_NAME].value == "Devansh Varma"
    assert facts_dict[FactType.APPLICANT_NAME].sourcePage == 1
    assert "Devansh Varma" in facts_dict[FactType.APPLICANT_NAME].evidence

    # Bank Account & Sensitivity
    assert FactType.BANK_ACCOUNT_NUMBER in facts_dict
    assert facts_dict[FactType.BANK_ACCOUNT_NUMBER].value == "123456789012"
    assert facts_dict[FactType.BANK_ACCOUNT_NUMBER].sensitivity == FactSensitivity.HIGHLY_SENSITIVE

    # IFSC
    assert FactType.BANK_IFSC_CODE in facts_dict
    assert facts_dict[FactType.BANK_IFSC_CODE].value == "SBIN0001234"

    # Income & Sensitivity
    assert FactType.INCOME_AMOUNT in facts_dict
    assert "1,80,000" in facts_dict[FactType.INCOME_AMOUNT].value
    assert facts_dict[FactType.INCOME_AMOUNT].sensitivity == FactSensitivity.SENSITIVE

    # Percentage
    assert FactType.PERCENTAGE_MARKS in facts_dict
    assert facts_dict[FactType.PERCENTAGE_MARKS].value == "86.4%"

    # Domicile
    assert FactType.DOMICILE_STATE in facts_dict
    assert facts_dict[FactType.DOMICILE_STATE].value == "Maharashtra"


def test_empty_document_produces_no_fabricated_facts():
    # DOC-15: Missing evidence cannot produce high-confidence facts
    page = DocumentPageRepresentation(pageNumber=1, text="", headings=[], detectedFacts=[])
    doc = DocumentRepresentation(
        documentId="doc_empty",
        filename="empty.pdf",
        mimeType="application/pdf",
        pageCount=1,
        extractedTextAvailable=False,
        pages=[page],
    )
    facts = extract_document_facts(doc)
    assert len(facts) == 0
