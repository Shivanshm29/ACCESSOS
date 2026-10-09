"""Document parsing and extraction engine (Phase 9).

Safe local ingestion of PDFs, images, and text files using PyMuPDF and Pillow.
Enforces strict file size, page count, and text length boundaries, with robust
error handling for corrupt and password-protected files.
"""

import base64
import io
import os
import uuid
from typing import Optional, Tuple, List
import pymupdf
from PIL import Image

from app.document.constants import (
    MAX_EVIDENCE_LENGTH,
    MAX_EXTRACTED_TEXT_LENGTH,
    MAX_FILE_SIZE_BYTES,
    MAX_PAGE_COUNT,
    SUPPORTED_EXTENSIONS,
    SUPPORTED_MIME_TYPES,
)
from app.document.schemas import (
    DocumentClassification,
    DocumentPageRepresentation,
    DocumentRepresentation,
    DocumentType,
)
from app.document.sanitization import sanitize_filename, truncate_evidence


def validate_file_metadata(filename: str, file_size: int, mime_type: Optional[str] = None) -> None:
    """Validate document extension, MIME type, and size bounds."""
    sanitized = sanitize_filename(filename)
    ext = os.path.splitext(sanitized)[1].lower()

    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext}'. Supported extensions: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    if mime_type and mime_type.lower() not in SUPPORTED_MIME_TYPES:
        # If extension is supported but mime is generic octet-stream, permit if extension is known
        if mime_type.lower() != "application/octet-stream":
            raise ValueError(
                f"Unsupported MIME type '{mime_type}'. Supported MIME types: {', '.join(SUPPORTED_MIME_TYPES)}"
            )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"File size ({file_size} bytes) exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES} bytes (10MB)."
        )


def parse_pdf_bytes(
    file_bytes: bytes,
    document_id: str,
    filename: str,
) -> DocumentRepresentation:
    """Safely parse a PDF file using PyMuPDF with corruption & password detection."""
    warnings: List[str] = []
    pages: List[DocumentPageRepresentation] = []
    total_text = ""

    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        # Corrupt PDF handling (DOC-04)
        return DocumentRepresentation(
            documentId=document_id,
            filename=filename,
            mimeType="application/pdf",
            pageCount=0,
            extractedTextAvailable=False,
            pages=[],
            metadata={"fileSizeBytes": len(file_bytes), "corrupt": True},
            documentType=DocumentClassification(
                category=DocumentType.UNKNOWN,
                confidence=0.0,
                reason="Corrupt or invalid PDF structure",
            ),
            extractionWarnings=[f"Document corrupted or unreadable: {str(exc)[:100]}"],
        )

    try:
        # Encrypted / password-protected check (DOC-05)
        if doc.is_encrypted:
            return DocumentRepresentation(
                documentId=document_id,
                filename=filename,
                mimeType="application/pdf",
                pageCount=doc.page_count,
                extractedTextAvailable=False,
                pages=[],
                metadata={"fileSizeBytes": len(file_bytes), "encrypted": True},
                documentType=DocumentClassification(
                    category=DocumentType.UNKNOWN,
                    confidence=0.0,
                    reason="Document is password-protected",
                ),
                extractionWarnings=["Document is password-protected or encrypted; decryption required"],
            )

        # Page count bounds (DOC-03)
        page_count = doc.page_count
        if page_count > MAX_PAGE_COUNT:
            raise ValueError(
                f"Document page count ({page_count}) exceeds maximum allowed limit of {MAX_PAGE_COUNT} pages."
            )

        for page_idx in range(page_count):
            page = doc[page_idx]
            page_text = page.get_text() or ""
            # Truncate if individual page is unusually huge
            if len(page_text) > MAX_EXTRACTED_TEXT_LENGTH:
                page_text = page_text[:MAX_EXTRACTED_TEXT_LENGTH]
                warnings.append(f"Page {page_idx + 1} text truncated to maximum character limit.")

            total_text += page_text + "\n"

            # Extract headings (lines ending with colon or short uppercase lines)
            headings: List[str] = []
            snippets: List[str] = []
            for line in page_text.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if (stripped.isupper() and len(stripped) < 80) or stripped.endswith(":"):
                    headings.append(stripped)
                if len(stripped) > 20 and len(snippets) < 10:
                    snippets.append(truncate_evidence(stripped))

            pages.append(
                DocumentPageRepresentation(
                    pageNumber=page_idx + 1,
                    text=page_text,
                    headings=headings[:10],
                    detectedFacts=[],
                    evidenceSnippets=snippets,
                )
            )

        metadata = {
            "fileSizeBytes": len(file_bytes),
            "pdfFormat": doc.metadata.get("format", "PDF"),
            "author": doc.metadata.get("author", ""),
            "title": doc.metadata.get("title", ""),
            "creationDate": doc.metadata.get("creationDate", ""),
        }

        return DocumentRepresentation(
            documentId=document_id,
            filename=filename,
            mimeType="application/pdf",
            pageCount=page_count,
            extractedTextAvailable=bool(total_text.strip()),
            pages=pages,
            metadata=metadata,
            documentType=DocumentClassification(
                category=DocumentType.UNKNOWN,
                confidence=0.0,
                reason="Parsed successfully, awaiting classification",
            ),
            extractionWarnings=warnings,
        )
    finally:
        doc.close()


def parse_image_bytes(
    file_bytes: bytes,
    document_id: str,
    filename: str,
    mime_type: str,
) -> DocumentRepresentation:
    """Safely validate image integrity using Pillow and extract metadata."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
    except Exception as exc:
        return DocumentRepresentation(
            documentId=document_id,
            filename=filename,
            mimeType=mime_type,
            pageCount=0,
            extractedTextAvailable=False,
            pages=[],
            metadata={"fileSizeBytes": len(file_bytes), "corrupt": True},
            documentType=DocumentClassification(
                category=DocumentType.UNKNOWN,
                confidence=0.0,
                reason="Corrupt or unreadable image file",
            ),
            extractionWarnings=[f"Image corrupted or invalid: {str(exc)[:100]}"],
        )

    # Re-open for metadata inspection (verify invalidates Image object)
    img = Image.open(io.BytesIO(file_bytes))
    width, height = img.size
    img_format = img.format or "IMAGE"

    metadata = {
        "fileSizeBytes": len(file_bytes),
        "dimensions": f"{width}x{height}",
        "format": img_format,
    }

    # For image documents in the demo without OCR engine installed,
    # we represent single page image with metadata
    page_text = f"Image Document: {filename} ({img_format}, {width}x{height})"
    pages = [
        DocumentPageRepresentation(
            pageNumber=1,
            text=page_text,
            headings=[f"Image: {filename}"],
            detectedFacts=[],
            evidenceSnippets=[f"Image {filename} ({width}x{height})"],
        )
    ]

    return DocumentRepresentation(
        documentId=document_id,
        filename=filename,
        mimeType=mime_type,
        pageCount=1,
        extractedTextAvailable=True,
        pages=pages,
        metadata=metadata,
        documentType=DocumentClassification(
            category=DocumentType.UNKNOWN,
            confidence=0.0,
            reason="Image ingested successfully, awaiting classification",
        ),
        extractionWarnings=[],
    )


def parse_text_content(
    text: str,
    document_id: str,
    filename: str,
) -> DocumentRepresentation:
    """Ingest plain text representation directly."""
    bounded_text = text[:MAX_EXTRACTED_TEXT_LENGTH]
    headings: List[str] = []
    snippets: List[str] = []

    for line in bounded_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if (stripped.isupper() and len(stripped) < 80) or stripped.endswith(":"):
            headings.append(stripped)
        if len(stripped) > 20 and len(snippets) < 10:
            snippets.append(truncate_evidence(stripped))

    page = DocumentPageRepresentation(
        pageNumber=1,
        text=bounded_text,
        headings=headings[:10],
        detectedFacts=[],
        evidenceSnippets=snippets,
    )

    return DocumentRepresentation(
        documentId=document_id,
        filename=filename,
        mimeType="text/plain",
        pageCount=1,
        extractedTextAvailable=bool(bounded_text.strip()),
        pages=[page],
        metadata={"fileSizeBytes": len(text.encode("utf-8"))},
        documentType=DocumentClassification(
            category=DocumentType.UNKNOWN,
            confidence=0.0,
            reason="Plain text document ingested",
        ),
        extractionWarnings=[],
    )


def ingest_document(
    filename: str,
    file_bytes: Optional[bytes] = None,
    file_base64: Optional[str] = None,
    text: Optional[str] = None,
    mime_type: Optional[str] = None,
    document_id: Optional[str] = None,
) -> DocumentRepresentation:
    """Primary entry point to ingest and parse an untrusted document."""
    doc_id = document_id or f"doc_{uuid.uuid4().hex[:12]}"
    clean_filename = sanitize_filename(filename)
    ext = os.path.splitext(clean_filename)[1].lower()

    # Resolve raw bytes if provided as base64
    if file_base64 and not file_bytes:
        try:
            # Strip data URL prefix if present
            if "," in file_base64:
                file_base64 = file_base64.split(",", 1)[1]
            file_bytes = base64.b64decode(file_base64)
        except Exception as e:
            raise ValueError(f"Invalid base64 document payload: {str(e)}")

    if file_bytes is not None:
        file_size = len(file_bytes)
        validate_file_metadata(clean_filename, file_size, mime_type)

        if ext == ".pdf":
            return parse_pdf_bytes(file_bytes, doc_id, clean_filename)
        elif ext in (".png", ".jpg", ".jpeg"):
            inferred_mime = mime_type or ("image/png" if ext == ".png" else "image/jpeg")
            return parse_image_bytes(file_bytes, doc_id, clean_filename, inferred_mime)
        elif ext == ".txt":
            try:
                decoded_text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                decoded_text = file_bytes.decode("latin-1", errors="replace")
            return parse_text_content(decoded_text, doc_id, clean_filename)
        else:
            raise ValueError(f"Unsupported document format: '{ext}'")

    if text is not None:
        validate_file_metadata(clean_filename, len(text.encode("utf-8")), "text/plain")
        return parse_text_content(text, doc_id, clean_filename)

    raise ValueError("Document payload required: provide either file bytes, base64 payload, or text content.")
