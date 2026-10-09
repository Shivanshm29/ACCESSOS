"""
ACCESSOS Real-Site Testing Schemas (Phase 14)
Strongly typed models for real-site allowlists, validation modes,
and compatibility classifications.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SiteCategory(str, Enum):
    STATIC_INFORMATIONAL = "STATIC_INFORMATIONAL"
    DOCUMENTATION_HELP = "DOCUMENTATION_HELP"
    ARTICLE_CONTENT = "ARTICLE_CONTENT"
    SEARCH_INTERFACE = "SEARCH_INTERFACE"
    FORM_NO_SUBMISSION = "FORM_NO_SUBMISSION"
    MULTI_SECTION_FORM = "MULTI_SECTION_FORM"
    GOV_INSTITUTIONAL = "GOV_INSTITUTIONAL"
    TABLES_DATA = "TABLES_DATA"
    MODAL_DIALOG = "MODAL_DIALOG"
    DYNAMIC_RENDERED = "DYNAMIC_RENDERED"


class CompatibilityClassification(str, Enum):
    FULL_SUPPORT = "FULL_SUPPORT"
    PARTIAL_SUPPORT = "PARTIAL_SUPPORT"
    READ_ONLY_SUPPORT = "READ_ONLY_SUPPORT"
    UNSUPPORTED = "UNSUPPORTED"
    BLOCKED_BY_SAFETY_POLICY = "BLOCKED_BY_SAFETY_POLICY"


class TestMode(str, Enum):
    __test__ = False
    MODE_A_READ_ONLY = "MODE_A_READ_ONLY"
    MODE_B_CONTROLLED_INTERACTION = "MODE_B_CONTROLLED_INTERACTION"


class RealSiteEntry(BaseModel):
    id: str
    name: str
    publicUrl: str
    category: SiteCategory
    whySelected: str
    expectedDomCharacteristics: List[str]
    permittedOperations: List[str]
    prohibitedOperations: List[str]
    dateTested: str
    expectedCompatibility: CompatibilityClassification


class ExtractionMetrics(BaseModel):
    titlePresent: bool = True
    headingsCount: int = 0
    landmarksCount: int = 0
    sectionsCount: int = 0
    formsCount: int = 0
    fieldsCount: int = 0
    buttonsCount: int = 0
    linksCount: int = 0
    instructionsCount: int = 0
    imagesCount: int = 0
    stableIdsGenerated: int = 0
    extractionDurationMs: float = 0.0


class AccessibilityMetrics(BaseModel):
    totalFindings: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    score: int = 100
    scoreBand: str = "Good"
    analysisDurationMs: float = 0.0


class RealSiteValidationResult(BaseModel):
    siteId: str
    siteName: str
    publicUrl: str
    category: SiteCategory
    mode: TestMode = TestMode.MODE_A_READ_ONLY
    extractionSuccess: bool = True
    extractionMetrics: Optional[ExtractionMetrics] = None
    accessibilitySuccess: bool = True
    accessibilityMetrics: Optional[AccessibilityMetrics] = None
    aiAnalysisReady: bool = True
    aiSanitized: bool = True
    promptInjectionDefended: bool = True
    guidedModeStatus: str = "NOT_APPLICABLE"
    explainAnythingStatus: str = "SUPPORTED"
    documentRequirementsIdentified: int = 0
    completionStatus: str = "COMPLETION_UNSUPPORTED"
    safeInteractionOutcome: str = "NOT_APPLICABLE"
    compatibility: CompatibilityClassification = CompatibilityClassification.READ_ONLY_SUPPORT
    majorLimitations: List[str] = Field(default_factory=list)
    securityVerified: bool = True
    privacyVerified: bool = True
    testedDate: str = "2026-10-07"
