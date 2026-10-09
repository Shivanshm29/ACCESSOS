"""Document Intelligence API Endpoints (Phase 9).

Provides document ingestion, classification, grounded fact extraction,
and requirement matching APIs.
"""

from typing import List
from fastapi import APIRouter, HTTPException, status
from app.document.constants import SUPPORTED_MIME_TYPES
from app.document.orchestrator import DocumentOrchestrator
from app.document.schemas import (
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
    DocumentHealthResponse,
    DocumentRequirementMatch,
    DocumentRepresentation,
    ExtractedFact,
    PageRequirement,
)
from app.document.matcher import match_document_to_requirements

router = APIRouter(prefix="/document")
_orchestrator = DocumentOrchestrator()


@router.get("/health", response_model=DocumentHealthResponse, status_code=status.HTTP_200_OK)
async def document_health() -> DocumentHealthResponse:
    """Health check for Document Intelligence engine."""
    return DocumentHealthResponse(
        status="ready",
        service="document-intelligence",
        phase=9,
        supportedMimeTypes=list(SUPPORTED_MIME_TYPES),
    )


@router.post("/analyze", response_model=DocumentAnalysisResponse, status_code=status.HTTP_200_OK)
async def analyze_document_endpoint(request: DocumentAnalysisRequest) -> DocumentAnalysisResponse:
    """Analyze a user-provided document, extract facts, classify, and match against webpage requirements."""
    try:
        response = await _orchestrator.analyze(request)
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document analysis failed: {str(e)}",
        )
