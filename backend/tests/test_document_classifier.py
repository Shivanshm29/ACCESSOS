"""Unit tests for Document Classifier (Phase 9)."""

import pytest
from app.document.schemas import (
    DocumentPageRepresentation,
    DocumentRepresentation,
    DocumentType,
)
from app.document.classifier import classify_document


def _build_doc(text: str, filename: str = "doc.pdf") -> DocumentRepresentation:
    page = DocumentPageRepresentation(pageNumber=1, text=text, headings=[], detectedFacts=[])
    return DocumentRepresentation(
        documentId="doc_test",
        filename=filename,
        mimeType="application/pdf",
        pageCount=1,
        extractedTextAvailable=bool(text.strip()),
        pages=[page] if text else [],
    )


def test_classify_academic_marksheet():
    text = (
        "CENTRAL BOARD OF SECONDARY EDUCATION\n"
        "STATEMENT OF MARKS\n"
        "Name of Candidate: Devansh Varma\n"
        "Roll No: 4920194\n"
        "Total Marks: 432 / 500\n"
        "Percentage of Marks: 86.4%\n"
        "Result: PASSED IN FIRST DIVISION\n"
    )
    doc = _build_doc(text)
    res = classify_document(doc)
    assert res.category == DocumentType.ACADEMIC_MARKSHEET
    assert res.confidence >= 0.70
    assert res.evidence is not None


def test_classify_income_certificate():
    text = (
        "GOVERNMENT OF MAHARASHTRA\n"
        "REVENUE AND FOREST DEPARTMENT\n"
        "INCOME CERTIFICATE\n"
        "This is to certify that Gross Annual Family Income of Shri Devansh Varma is Rs. 1,80,000.\n"
        "Issued by Tahsildar Office.\n"
    )
    doc = _build_doc(text)
    res = classify_document(doc)
    assert res.category == DocumentType.INCOME_CERTIFICATE
    assert res.confidence >= 0.70


def test_classify_bank_document():
    text = (
        "STATE BANK OF INDIA\n"
        "SAVINGS BANK PASSBOOK\n"
        "Account Holder Name: Devansh Varma\n"
        "Account Number: 123456789012\n"
        "IFSC Code: SBIN0001234\n"
        "Branch: Pune Main Branch\n"
    )
    doc = _build_doc(text)
    res = classify_document(doc)
    assert res.category == DocumentType.BANK_DOCUMENT
    assert res.confidence >= 0.70


def test_classify_domicile_certificate():
    text = (
        "GOVERNMENT OF MAHARASHTRA\n"
        "DOMICILE CERTIFICATE\n"
        "This certifies that candidate is Ordinarily Resident in State of Maharashtra.\n"
    )
    doc = _build_doc(text)
    res = classify_document(doc)
    assert res.category == DocumentType.DOMICILE_CERTIFICATE
    assert res.confidence >= 0.70


def test_classify_unknown_when_content_lacks_evidence():
    # DOC-16: Filename alone cannot establish classification
    doc = _build_doc("", filename="income_certificate.pdf")
    res = classify_document(doc)
    assert res.category == DocumentType.UNKNOWN
    assert res.confidence == 0.0

    unrelated_text = "The quick brown fox jumps over the lazy dog repeatedly on a summer afternoon."
    doc2 = _build_doc(unrelated_text, filename="income_tax.pdf")
    res2 = classify_document(doc2)
    assert res2.category == DocumentType.UNKNOWN
