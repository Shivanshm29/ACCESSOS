"""Schemas for API requests and responses."""
from app.schemas.health import HealthResponse
from app.schemas.ai_analysis import (
    PageType,
    AIBarrierType,
    AISeverity,
    PageUnderstanding,
    ProcessUnderstanding,
    AIBarrierFinding,
    NextAction,
    AIPageAnalysisResponse,
    AIPageAnalysisRequest,
    AIHealthResponse,
)

from app.guided.schemas import (
    ActionType,
    GuidedStep,
    GuidedModeResponse,
    GuidedModeStartRequest,
)

from app.explain.schemas import (
    ExplanationMode,
    ExplainSelectionContext,
    ExplainAnythingRequest,
    TermDefinition,
    ExplainAnythingResponse,
)

from app.interaction.schemas import (
    ActionType as InteractionActionType,
    RiskLevel,
    IntentSource,
    InteractionStatus,
    InteractionIntent,
    InteractionResult,
    ValidateIntentRequest,
    ValidateIntentResponse,
)

__all__ = [
    "HealthResponse",
    "PageType",
    "AIBarrierType",
    "AISeverity",
    "PageUnderstanding",
    "ProcessUnderstanding",
    "AIBarrierFinding",
    "NextAction",
    "AIPageAnalysisResponse",
    "AIPageAnalysisRequest",
    "AIHealthResponse",
    "ActionType",
    "GuidedStep",
    "GuidedModeResponse",
    "GuidedModeStartRequest",
    "ExplanationMode",
    "ExplainSelectionContext",
    "ExplainAnythingRequest",
    "TermDefinition",
    "ExplainAnythingResponse",
    "InteractionActionType",
    "RiskLevel",
    "IntentSource",
    "InteractionStatus",
    "InteractionIntent",
    "InteractionResult",
    "ValidateIntentRequest",
    "ValidateIntentResponse",
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
]

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



