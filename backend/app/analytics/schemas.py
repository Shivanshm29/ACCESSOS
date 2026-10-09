"""
ACCESSOS Analytics Schemas (Phase 13)
Defines strongly typed, privacy-preserving models for local analytics.
Strictly forbids arbitrary fields or sensitive data.
"""

from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


class AnalyticsEventType(str, Enum):
    ACCESSIBILITY_ANALYSIS = "ACCESSIBILITY_ANALYSIS"
    AI_ANALYSIS = "AI_ANALYSIS"
    GUIDED_MODE_STARTED = "GUIDED_MODE_STARTED"
    GUIDED_STEP_COMPLETED = "GUIDED_STEP_COMPLETED"
    GUIDED_MODE_COMPLETED = "GUIDED_MODE_COMPLETED"
    EXPLANATION_REQUESTED = "EXPLANATION_REQUESTED"
    DOCUMENT_ANALYSIS = "DOCUMENT_ANALYSIS"
    DOCUMENT_REQUIREMENT_MATCH = "DOCUMENT_REQUIREMENT_MATCH"
    COMPLETION_CHECK = "COMPLETION_CHECK"
    COMPLETION_ACHIEVED = "COMPLETION_ACHIEVED"
    COMPLETION_BLOCKED = "COMPLETION_BLOCKED"
    SAFE_INTERACTION_CONFIRMED = "SAFE_INTERACTION_CONFIRMED"
    SAFE_INTERACTION_BLOCKED = "SAFE_INTERACTION_BLOCKED"
    USER_EXITED_FEATURE = "USER_EXITED_FEATURE"
    ERROR = "ERROR"


class DurationBucket(str, Enum):
    LESS_THAN_1S = "<1s"
    ONE_TO_FIVE_S = "1-5s"
    FIVE_TO_FIFTEEN_S = "5-15s"
    FIFTEEN_TO_THIRTY_S = "15-30s"
    THIRTY_TO_SIXTY_S = "30-60s"
    OVER_SIXTY_S = ">60s"


class CoarseResultCategory(str, Enum):
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"
    BLOCKED = "BLOCKED"
    INVALID = "INVALID"
    MATCH = "MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    NO_MATCH = "NO_MATCH"
    AMBIGUOUS = "AMBIGUOUS"
    NOT_ENOUGH_EVIDENCE = "NOT_ENOUGH_EVIDENCE"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    SUCCESS = "SUCCESS"
    SKIPPED = "SKIPPED"
    EXHAUSTED = "EXHAUSTED"
    ERROR = "ERROR"


class CoarseErrorCategory(str, Enum):
    INVALID_INPUT = "INVALID_INPUT"
    POLICY_BLOCKED = "POLICY_BLOCKED"
    SCHEMA_VIOLATION = "SCHEMA_VIOLATION"
    TARGET_NOT_FOUND = "TARGET_NOT_FOUND"
    NETWORK_BLOCKED = "NETWORK_BLOCKED"
    AI_PROVIDER_ERROR = "AI_PROVIDER_ERROR"
    DOCUMENT_PARSE_ERROR = "DOCUMENT_PARSE_ERROR"
    COMPLETION_ERROR = "COMPLETION_ERROR"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class AnonymizedTargetCategory(str, Enum):
    INPUT = "input"
    BUTTON = "button"
    SELECT = "select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    FILE_UPLOAD = "file_upload"
    LINK = "link"
    HEADING = "heading"
    SECTION = "section"
    DIALOG = "dialog"
    FORM = "form"
    UNKNOWN = "unknown"


class AnalyticsEvent(BaseModel):
    """
    Privacy-safe analytics event schema.
    Strictly forbids arbitrary extra fields.
    """
    model_config = ConfigDict(extra="forbid")

    eventId: str = Field(description="Unique ephemeral event identifier")
    eventType: AnalyticsEventType = Field(description="Categorical event type")
    timestamp: int = Field(description="Unix millisecond timestamp")
    sessionId: str = Field(description="Ephemeral, non-identifying session ID")
    feature: str = Field(description="ACCESSOS feature identifier")
    durationBucket: Optional[DurationBucket] = Field(default=None, description="Coarse duration category")
    success: bool = Field(default=True, description="Whether the operation succeeded")
    coarseResultCategory: Optional[CoarseResultCategory] = Field(default=None, description="Coarse result")
    stageId: Optional[str] = Field(default=None, description="Coarse stage identifier")
    anonymizedTargetCategory: Optional[AnonymizedTargetCategory] = Field(
        default=None, description="Coarse semantic target category, never raw DOM IDs or selectors"
    )
    countMetrics: Optional[Dict[str, int]] = Field(default=None, description="Aggregated count values")
    errorCode: Optional[CoarseErrorCategory] = Field(default=None, description="Coarse error category")
    version: int = Field(default=1, description="Schema version")


class AnalyticsSession(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessionId: str
    startedAt: int
    lastActiveAt: int
    eventCount: int = 0


class BarriersBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class AccessibilityAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analyses: int = 0
    barriers: BarriersBreakdown = Field(default_factory=BarriersBreakdown)
    totalBarriers: int = 0
    pagesWithBarriers: int = 0
    scoreSum: int = 0
    scoreCount: int = 0
    averageScore: int = 0


class GuidedModeAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    started: int = 0
    completed: int = 0
    stepsCompleted: int = 0
    stepsSkipped: int = 0
    stepsExited: int = 0
    completionRate: int = 0


class ExplainModesBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    SIMPLE: int = 0
    STANDARD: int = 0
    DETAILED: int = 0


class ExplainAnythingAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requests: int = 0
    modes: ExplainModesBreakdown = Field(default_factory=ExplainModesBreakdown)
    completed: int = 0
    exited: int = 0


class DocumentAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analyzed: int = 0
    matches: int = 0
    partialMatches: int = 0
    noMatches: int = 0
    ambiguous: int = 0
    notEnoughEvidence: int = 0
    successful: int = 0
    failed: int = 0


def default_progress_buckets() -> Dict[str, int]:
    return {
        "0-25%": 0,
        "26-50%": 0,
        "51-75%": 0,
        "76-99%": 0,
        "100%": 0,
    }


class CompletionAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checks: int = 0
    complete: int = 0
    incomplete: int = 0
    blocked: int = 0
    invalid: int = 0
    totalBlockers: int = 0
    totalWarnings: int = 0
    checksBeforeCompletion: int = 0
    progressBuckets: Dict[str, int] = Field(default_factory=default_progress_buckets)


class InteractionActionBreakdown(BaseModel):
    model_config = ConfigDict(extra="forbid")

    CLICK: int = 0
    INPUT: int = 0
    SELECT: int = 0
    HIGHLIGHT: int = 0
    OTHER: int = 0


class InteractionAggregates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requested: int = 0
    confirmed: int = 0
    blocked: int = 0
    cancelled: int = 0
    byAction: InteractionActionBreakdown = Field(default_factory=InteractionActionBreakdown)


class AnalyticsAggregates(BaseModel):
    """
    Aggregated coarse metrics model.
    """
    model_config = ConfigDict(extra="forbid")

    accessibility: AccessibilityAggregates = Field(default_factory=AccessibilityAggregates)
    guidedMode: GuidedModeAggregates = Field(default_factory=GuidedModeAggregates)
    explainAnything: ExplainAnythingAggregates = Field(default_factory=ExplainAnythingAggregates)
    documents: DocumentAggregates = Field(default_factory=DocumentAggregates)
    completion: CompletionAggregates = Field(default_factory=CompletionAggregates)
    interactions: InteractionAggregates = Field(default_factory=InteractionAggregates)
    durationBuckets: Dict[str, int] = Field(default_factory=dict)
    errors: Dict[str, int] = Field(default_factory=dict)
    totalEvents: int = 0
    lastUpdated: int = 0
