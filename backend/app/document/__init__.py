"""ACCESSOS Document Intelligence (Phase 9).

Safe local document ingestion, structure & fact extraction, classification,
and grounded webpage requirement matching.
"""

from app.document.schemas import (
    DocumentType,
    FactType,
    FactSensitivity,
    MatchStatus,
    ExtractedFact,
    DocumentPageRepresentation,
    DocumentClassification,
    DocumentRepresentation,
    PageRequirement,
    DocumentRequirementMatch,
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
    DocumentHealthResponse,
)
from app.document.parser import ingest_document
from app.document.classifier import classify_document
from app.document.extractor import extract_document_facts
from app.document.matcher import match_document_to_requirements
from app.document.fallback import run_deterministic_analysis
from app.document.orchestrator import DocumentOrchestrator

__all__ = [
    "DocumentType",
    "FactType",
    "FactSensitivity",
    "MatchStatus",
    "ExtractedFact",
    "DocumentPageRepresentation",
    "DocumentClassification",
    "DocumentRepresentation",
    "PageRequirement",
    "DocumentRequirementMatch",
    "DocumentAnalysisRequest",
    "DocumentAnalysisResponse",
    "DocumentHealthResponse",
    "ingest_document",
    "classify_document",
    "extract_document_facts",
    "match_document_to_requirements",
    "run_deterministic_analysis",
    "DocumentOrchestrator",
]
