"""Pydantic schemas for ACCESSOS Document Intelligence (Phase 9).

Type-safe, strictly bounded representations of user documents, extracted facts,
evidence grounding, and requirement matching.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from app.document.constants import (
    MAX_EVIDENCE_LENGTH,
    MAX_EXTRACTED_TEXT_LENGTH,
    MAX_FACTS_COUNT,
    MAX_PAGE_COUNT,
)


class DocumentType(str, Enum):
    """Categorization of supported workflow documents."""
    IDENTITY_DOCUMENT = "IDENTITY_DOCUMENT"
    DOMICILE_CERTIFICATE = "DOMICILE_CERTIFICATE"
    ACADEMIC_MARKSHEET = "ACADEMIC_MARKSHEET"
    INCOME_CERTIFICATE = "INCOME_CERTIFICATE"
    BANK_DOCUMENT = "BANK_DOCUMENT"
    DECLARATION = "DECLARATION"
    MISCELLANEOUS = "MISCELLANEOUS"
    UNKNOWN = "UNKNOWN"


class FactType(str, Enum):
    """Types of structured facts extracted from documents."""
    APPLICANT_NAME = "APPLICANT_NAME"
    FATHER_NAME = "FATHER_NAME"
    DOB = "DOB"
    INSTITUTION_NAME = "INSTITUTION_NAME"
    EXAMINATION_YEAR = "EXAMINATION_YEAR"
    PERCENTAGE_MARKS = "PERCENTAGE_MARKS"
    GRADE_OR_CGPA = "GRADE_OR_CGPA"
    INCOME_AMOUNT = "INCOME_AMOUNT"
    DOMICILE_STATE = "DOMICILE_STATE"
    BANK_ACCOUNT_HOLDER = "BANK_ACCOUNT_HOLDER"
    BANK_ACCOUNT_NUMBER = "BANK_ACCOUNT_NUMBER"
    BANK_NAME = "BANK_NAME"
    BANK_IFSC_CODE = "BANK_IFSC_CODE"
    DOCUMENT_DATE = "DOCUMENT_DATE"
    CERTIFICATE_NUMBER = "CERTIFICATE_NUMBER"
    OTHER = "OTHER"


class FactSensitivity(str, Enum):
    """Classification of data sensitivity for privacy controls."""
    NON_SENSITIVE = "NON_SENSITIVE"
    SENSITIVE = "SENSITIVE"
    HIGHLY_SENSITIVE = "HIGHLY_SENSITIVE"


class MatchStatus(str, Enum):
    """Status of matching document against a webpage requirement."""
    MATCH = "MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    NO_MATCH = "NO_MATCH"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_ENOUGH_EVIDENCE = "NOT_ENOUGH_EVIDENCE"


class ExtractedFact(BaseModel):
    """A single factual claim extracted from a document with grounded evidence."""
    factType: FactType
    value: str = Field(..., max_length=500)
    confidence: float = Field(default=0.0)
    sourcePage: int = Field(..., ge=1, le=MAX_PAGE_COUNT)
    evidence: str = Field(..., max_length=MAX_EVIDENCE_LENGTH)
    sensitivity: FactSensitivity = Field(default=FactSensitivity.NON_SENSITIVE)

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, v: Any) -> float:
        try:
            return round(max(0.0, min(1.0, float(v))), 3)
        except Exception:
            return 0.0


class DocumentPageRepresentation(BaseModel):
    """Bounded representation of a single document page."""
    pageNumber: int = Field(..., ge=1, le=MAX_PAGE_COUNT)
    text: str = Field(..., max_length=MAX_EXTRACTED_TEXT_LENGTH)
    headings: List[str] = Field(default_factory=list)
    detectedFacts: List[ExtractedFact] = Field(default_factory=list)
    evidenceSnippets: List[str] = Field(default_factory=list)


class DocumentClassification(BaseModel):
    """Categorization of a document based on content analysis."""
    category: DocumentType = Field(default=DocumentType.UNKNOWN)
    confidence: float = Field(default=0.0)
    reason: str = Field(..., max_length=500)
    evidence: Optional[str] = Field(default=None, max_length=MAX_EVIDENCE_LENGTH)

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, v: Any) -> float:
        try:
            return round(max(0.0, min(1.0, float(v))), 3)
        except Exception:
            return 0.0


class DocumentRepresentation(BaseModel):
    """Safe, structured representation of an ingested document."""
    documentId: str = Field(..., min_length=1, max_length=128)
    filename: str = Field(..., min_length=1, max_length=255)
    mimeType: str = Field(..., min_length=1, max_length=100)
    pageCount: int = Field(..., ge=0, le=MAX_PAGE_COUNT)
    extractedTextAvailable: bool = Field(default=False)
    pages: List[DocumentPageRepresentation] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    documentType: DocumentClassification = Field(default_factory=lambda: DocumentClassification(
        category=DocumentType.UNKNOWN,
        confidence=0.0,
        reason="Not classified yet",
    ))
    extractionWarnings: List[str] = Field(default_factory=list)


class PageRequirement(BaseModel):
    """A requirement derived from the webpage or application form."""
    requirementId: str = Field(..., min_length=1, max_length=100)
    targetFieldId: Optional[str] = Field(default=None, max_length=150)
    requirementType: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    mandatory: bool = Field(default=True)
    expectedDocumentType: Optional[DocumentType] = None
    expectedValues: Optional[Dict[str, str]] = None


class DocumentRequirementMatch(BaseModel):
    """Grounded result comparing a document to a webpage requirement."""
    requirementId: str = Field(..., min_length=1, max_length=100)
    requirementDescription: str = Field(..., min_length=1, max_length=500)
    documentId: str = Field(..., min_length=1, max_length=128)
    matchStatus: MatchStatus = Field(...)
    confidence: float = Field(default=0.0)
    evidence: str = Field(default="", max_length=MAX_EVIDENCE_LENGTH)
    reason: str = Field(..., max_length=500)
    suggestedUploadFieldId: Optional[str] = Field(default=None, max_length=150)
    warnings: List[str] = Field(default_factory=list)

    @field_validator("confidence", mode="before")
    @classmethod
    def clamp_confidence(cls, v: Any) -> float:
        try:
            return round(max(0.0, min(1.0, float(v))), 3)
        except Exception:
            return 0.0


class DocumentAnalysisRequest(BaseModel):
    """Request payload for document analysis."""
    documentId: Optional[str] = Field(default=None, max_length=128)
    filename: str = Field(..., min_length=1, max_length=255)
    fileBase64: Optional[str] = None
    text: Optional[str] = Field(default=None, max_length=MAX_EXTRACTED_TEXT_LENGTH)
    mimeType: Optional[str] = Field(default=None, max_length=100)
    pageRequirements: Optional[List[PageRequirement]] = Field(default_factory=list)
    pageUrl: Optional[str] = Field(default=None, max_length=2000)


class DocumentAnalysisResponse(BaseModel):
    """Complete structured response from Document Intelligence."""
    document: DocumentRepresentation
    extractedFacts: List[ExtractedFact] = Field(default_factory=list)
    requirementMatches: List[DocumentRequirementMatch] = Field(default_factory=list)
    summary: str = Field(..., max_length=1000)
    analysisWarnings: List[str] = Field(default_factory=list)
    processingTimeMs: float = Field(default=0.0)


class DocumentHealthResponse(BaseModel):
    """Health check response for document intelligence."""
    status: str
    service: str
    phase: int
    supportedMimeTypes: List[str]
