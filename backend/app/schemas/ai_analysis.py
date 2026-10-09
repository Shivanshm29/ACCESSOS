"""Pydantic schemas for Phase 5 AI Page Analysis."""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class PageType(str, Enum):
    """Classified purpose of the webpage."""
    INFORMATION = "INFORMATION"
    APPLICATION = "APPLICATION"
    REGISTRATION = "REGISTRATION"
    PAYMENT = "PAYMENT"
    DOCUMENT_SUBMISSION = "DOCUMENT_SUBMISSION"
    TRACKING = "TRACKING"
    PROFILE = "PROFILE"
    OTHER = "OTHER"


class AIBarrierType(str, Enum):
    """Controlled categories of AI-identified semantic/cognitive barriers."""
    LANGUAGE_COMPLEXITY = "LANGUAGE_COMPLEXITY"
    UNFAMILIAR_TERM = "UNFAMILIAR_TERM"
    AMBIGUOUS_INSTRUCTION = "AMBIGUOUS_INSTRUCTION"
    COGNITIVE_LOAD = "COGNITIVE_LOAD"
    PROCESS_COMPLEXITY = "PROCESS_COMPLEXITY"
    INFORMATION_GROUPING = "INFORMATION_GROUPING"
    REQUIREMENT_CLARITY = "REQUIREMENT_CLARITY"
    NEXT_ACTION_UNCLEAR = "NEXT_ACTION_UNCLEAR"
    OTHER = "OTHER"


class AISeverity(str, Enum):
    """AI severity levels. CRITICAL is prohibited for AI findings."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PageUnderstanding(BaseModel):
    """Semantic understanding of the page's role and purpose."""
    pageType: PageType = Field(description="Controlled classification of the page.")
    pagePurpose: str = Field(description="Concise description of what the page is for.")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence estimate (0.0 to 1.0).")


class ProcessUnderstanding(BaseModel):
    """Process-level understanding inferred from the page structure."""
    processName: str = Field(description="Name of the inferred user process.")
    goal: str = Field(description="Expected accomplishment/goal of the user.")
    currentStage: Optional[str] = Field(default=None, description="Current workflow stage if identifiable.")
    totalStages: Optional[int] = Field(default=None, ge=1, description="Estimated total workflow stages.")
    majorStages: List[str] = Field(default_factory=list, description="Ordered stages inferred from sections.")
    requiredInformationCategories: List[str] = Field(default_factory=list, description="Categories of info needed.")
    requiredDocumentCategories: List[str] = Field(default_factory=list, description="Categories of files needed.")
    likelyNextAction: str = Field(description="Recommended next step for the user.")


class AIBarrierFinding(BaseModel):
    """A semantic, linguistic, or cognitive barrier identified by AI."""
    id: str = Field(description="Unique finding identifier, e.g. ai-barrier-001.")
    type: AIBarrierType = Field(description="Barrier category.")
    severity: AISeverity = Field(description="Severity (LOW, MEDIUM, HIGH only).")
    title: str = Field(description="Concise finding headline.")
    explanation: str = Field(description="Explanation grounded in provided evidence.")
    evidence: List[Dict[str, Any]] = Field(default_factory=list, description="Observable page evidence.")
    affectedElementIds: List[str] = Field(default_factory=list, description="Stable ACCESSOS element IDs.")
    suggestedSimplification: str = Field(description="Plain-language suggestion or mitigation.")
    confidence: float = Field(default=0.9, ge=0.0, le=1.0, description="Model confidence score.")

    @field_validator("severity", mode="before")
    @classmethod
    def reject_critical(cls, v: Any) -> Any:
        if isinstance(v, str) and v.upper() == "CRITICAL":
            # Per Phase 5 rules: AI findings must not be CRITICAL; downgrade to HIGH
            return AISeverity.HIGH
        return v


class NextAction(BaseModel):
    """Descriptive recommendation for the immediate next user step."""
    description: str = Field(description="Plain-language description of the next step.")
    targetElementId: Optional[str] = Field(default=None, description="Stable element ID of next control.")
    stage: Optional[str] = Field(default=None, description="Stage name.")


class AIPageAnalysisResponse(BaseModel):
    """Structured response validated after model analysis."""
    pageUnderstanding: PageUnderstanding
    processUnderstanding: ProcessUnderstanding
    barriers: List[AIBarrierFinding] = Field(default_factory=list, max_length=10)
    nextAction: NextAction
    summary: str = Field(description="Concise executive summary of page complexity.")
    provider: str = Field(default="mock", description="AI provider that generated the analysis.")
    model: str = Field(default="mock-v1", description="Model identifier used.")
    durationMs: Optional[float] = Field(default=None, description="Processing duration in milliseconds.")
    truncated: bool = Field(default=False, description="Whether input was truncated due to limits.")
    truncationNotes: Optional[List[str]] = Field(default=None, description="Details of any payload truncations.")


class AIPageAnalysisRequest(BaseModel):
    """Incoming request payload from extension containing PageRepresentation and report."""
    page: Dict[str, Any] = Field(description="Page metadata (title, URL, hostname).")
    representation: Optional[Dict[str, Any]] = Field(default=None, description="Structured PageRepresentation.")
    accessibilityReport: Optional[Dict[str, Any]] = Field(default=None, description="Phase 4 AccessibilityReport.")
    userGoal: Optional[str] = Field(default=None, max_length=500, description="Optional user-stated intent.")


class AIHealthResponse(BaseModel):
    """Health check for AI subsystem."""
    status: str
    activeProvider: str
    configuredModel: str
    availableProviders: List[str]
    hasApiKey: bool
