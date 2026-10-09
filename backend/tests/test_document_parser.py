"""Unit tests for Document parser (Phase 9).

Tests safe PDF, image, and text ingestion, corrupt/encrypted handling, and limits.
"""

import io
import pytest
import pymupdf
from PIL import Image

from app.document.parser import ingest_document, validate_file_metadata
from app.document.constants import MAX_FILE_SIZE_BYTES, MAX_PAGE_COUNT
from app.document.schemas import DocumentType


def _create_sample_pdf(text: str, encrypted: bool = False, password: str = "secret") -> bytes:
    """Helper to create a synthetic in-memory PDF."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 72), text)
    if encrypted:
        # Save encrypted PDF
        perm = int(
            pymupdf.PDF_PERM_ACCESSIBILITY
            | pymupdf.PDF_PERM_PRINT
            | pymupdf.PDF_PERM_COPY
            | pymupdf.PDF_PERM_ANNOTATE
        )
        pdf_bytes = doc.tobytes(
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            owner_pw=password,
            user_pw=password,
            permissions=perm,
        )
    else:
        pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_parse_valid_pdf():
    text_content = (
        "GOVERNMENT OF MAHARASHTRA\n"
        "REVENUE DEPARTMENT\n"
        "INCOME CERTIFICATE\n"
        "This is to certify that Shri Devansh Varma is an applicant.\n"
        "Annual Family Income: Rs. 1,80,000/- per annum\n"
        "Issued by: Tahsildar, Pune Urban\n"
    )
    pdf_bytes = _create_sample_pdf(text_content)
    doc = ingest_document(
        filename="income_certificate.pdf",
        file_bytes=pdf_bytes,
        mime_type="application/pdf",
    )
    assert doc.pageCount == 1
    assert doc.extractedTextAvailable is True
    assert "Devansh Varma" in doc.pages[0].text
    assert "1,80,000" in doc.pages[0].text
    assert len(doc.extractionWarnings) == 0


def test_corrupt_pdf_fails_safely():
    # Corrupt binary content (DOC-04)
    corrupt_bytes = b"%PDF-1.4\ncorrupt_random_bytes_that_are_not_valid_pdf_structure"
    doc = ingest_document(
        filename="corrupted_file.pdf",
        file_bytes=corrupt_bytes,
        mime_type="application/pdf",
    )
    assert doc.pageCount == 0
    assert doc.extractedTextAvailable is False
    assert len(doc.extractionWarnings) > 0
    assert "corrupt" in doc.extractionWarnings[0].lower()


def test_encrypted_pdf_fails_safely():
    # Encrypted / password-protected PDF (DOC-05)
    pdf_bytes = _create_sample_pdf("Confidential Income Data", encrypted=True, password="mypassword")
    doc = ingest_document(
        filename="encrypted_statement.pdf",
        file_bytes=pdf_bytes,
        mime_type="application/pdf",
    )
    assert doc.extractedTextAvailable is False
    assert len(doc.extractionWarnings) > 0
    assert "password-protected" in doc.extractionWarnings[0].lower() or "encrypted" in doc.extractionWarnings[0].lower()


def test_unsupported_file_extension_rejected():
    # DOC-01: Unsupported file type rejected
    with pytest.raises(ValueError, match="Unsupported file type"):
        validate_file_metadata("malware.exe", 1024, "application/octet-stream")

    with pytest.raises(ValueError, match="Unsupported file type"):
        ingest_document("data.bin", file_bytes=b"sample_binary_content")


def test_oversized_document_rejected():
    # DOC-02: Oversized document rejected (> 10MB)
    with pytest.raises(ValueError, match="exceeds maximum allowed limit"):
        validate_file_metadata("large.pdf", MAX_FILE_SIZE_BYTES + 100, "application/pdf")


def test_excessive_page_count_rejected():
    # DOC-03: Excessive page count (> 20 pages)
    doc = pymupdf.open()
    for _ in range(MAX_PAGE_COUNT + 5):
        page = doc.new_page()
        page.insert_text((50, 72), "Page Content")
    pdf_bytes = doc.tobytes()
    doc.close()

    with pytest.raises(ValueError, match="page count"):
        ingest_document("huge_doc.pdf", file_bytes=pdf_bytes, mime_type="application/pdf")


def test_parse_valid_image():
    # Test valid image ingestion using Pillow
    img = Image.new("RGB", (200, 100), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    doc = ingest_document(
        filename="id_card.png",
        file_bytes=img_bytes,
        mime_type="image/png",
    )
    assert doc.pageCount == 1
    assert doc.mimeType == "image/png"
    assert doc.metadata["dimensions"] == "200x100"


def test_parse_text_file():
    text_content = "Applicant: Devansh Varma\nAnnual Income: Rs. 1,50,000"
    doc = ingest_document(
        filename="statement.txt",
        text=text_content,
    )
    assert doc.pageCount == 1
    assert doc.extractedTextAvailable is True
    assert "Devansh Varma" in doc.pages[0].text
