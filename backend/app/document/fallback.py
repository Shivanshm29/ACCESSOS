"""Deterministic fallback engine for Document Intelligence (Phase 9).

Executes local deterministic parsing, classification, fact extraction, and
requirement matching without calling external LLM providers.
Guarantees 100% offline availability and zero probabilistic hallucinations.
"""

import time
from typing import List, Optional
from app.document.classifier import classify_document
from app.document.extractor import extract_document_facts
from app.document.matcher import match_document_to_requirements
from app.document.parser import ingest_document
from app.document.schemas import (
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
    DocumentRepresentation,
    DocumentType,
    ExtractedFact,
    MatchStatus,
)


def run_deterministic_analysis(request: DocumentAnalysisRequest) -> DocumentAnalysisResponse:
    """Run full deterministic document intelligence pipeline."""
    start_time = time.perf_counter()

    # 1. Ingest & parse document
    doc: DocumentRepresentation = ingest_document(
        filename=request.filename,
        file_base64=request.fileBase64,
        text=request.text,
        mime_type=request.mimeType,
        document_id=request.documentId,
    )

    # If parsing failed or file is corrupt / unreadable
    if not doc.extractedTextAvailable or doc.pageCount == 0:
        elapsed = (time.perf_counter() - start_time) * 1000
        warning_msg = doc.extractionWarnings[0] if doc.extractionWarnings else "Document could not be parsed."
        return DocumentAnalysisResponse(
            document=doc,
            extractedFacts=[],
            requirementMatches=[],
            summary=f"Analysis incomplete: {warning_msg}",
            analysisWarnings=doc.extractionWarnings,
            processingTimeMs=round(elapsed, 2),
        )

    # 2. Classify document
    classification = classify_document(doc)
    doc.documentType = classification

    # 3. Extract grounded facts
    facts: List[ExtractedFact] = extract_document_facts(doc)

    # 4. Match against webpage requirements
    matches = []
    if request.pageRequirements:
        matches = match_document_to_requirements(doc, facts, request.pageRequirements)

    # 5. Build summary
    doc_type_str = classification.category.value.replace("_", " ").title()
    summary_parts = [
        f"Document '{doc.filename}' ({doc.pageCount} page{'s' if doc.pageCount != 1 else ''}) "
        f"identified as {doc_type_str} with {int(classification.confidence * 100)}% confidence."
    ]

    matched_reqs = [m for m in matches if m.matchStatus == MatchStatus.MATCH]
    ambig_reqs = [m for m in matches if m.matchStatus == MatchStatus.AMBIGUOUS]

    if matched_reqs:
        req_names = ", ".join(f"'{m.requirementDescription}'" for m in matched_reqs[:2])
        summary_parts.append(f"Likely satisfies webpage requirement: {req_names}.")

    if ambig_reqs:
        for a in ambig_reqs:
            if a.warnings:
                summary_parts.append(f"Caution: {a.warnings[0]}")

    if not matched_reqs and not ambig_reqs and request.pageRequirements:
        summary_parts.append("Does not appear to satisfy any pending upload requirements on this page.")

    elapsed = (time.perf_counter() - start_time) * 1000

    return DocumentAnalysisResponse(
        document=doc,
        extractedFacts=facts,
        requirementMatches=matches,
        summary=" ".join(summary_parts),
        analysisWarnings=doc.extractionWarnings,
        processingTimeMs=round(elapsed, 2),
    )
