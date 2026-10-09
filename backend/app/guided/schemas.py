"""Pydantic schemas for Phase 6 Guided Mode."""
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    """
    Descriptive user action types.
    CRITICAL ARCHITECTURAL RULE:
    These values are strictly descriptive instructions for the human user.
    They must NEVER be executed by ACCESSOS as browser automation commands.
    """
    REVIEW = "REVIEW"
    READ = "READ"
    ENTER = "ENTER"
    SELECT = "SELECT"
    UPLOAD = "UPLOAD"
    CONFIRM = "CONFIRM"
    SUBMIT_REVIEW = "SUBMIT_REVIEW"


class GuidedStep(BaseModel):
    """A single sequential step guiding the user through a digital process."""
    stepId: str = Field(description="Unique step identifier, e.g. step-001.")
    order: int = Field(ge=1, description="1-indexed sequence order of the step.")
    title: str = Field(description="Concise action-oriented headline.")
    description: str = Field(description="Clear plain-language instruction for the user.")
    targetElementId: Optional[str] = Field(
        default=None,
        description="Stable ACCESSOS element ID of the relevant DOM element, e.g. accessos-field-001."
    )
    actionType: ActionType = Field(description="Descriptive category of human user action.")
    whyItMatters: str = Field(description="Plain-language explanation of why this step is required.")
    required: bool = Field(default=True, description="Whether completing this field or action is required.")
    completed: bool = Field(default=False, description="Whether the user has marked this step as done.")
    barrierNote: Optional[str] = Field(
        default=None,
        description="Optional notice highlighting known accessibility barriers or potential friction."
    )

    @field_validator("actionType", mode="before")
    @classmethod
    def normalize_action_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            val_upper = v.strip().upper()
            if val_upper in ActionType.__members__:
                return ActionType[val_upper]
            # Map common LLM variations safely to standard enums
            mapping = {
                "INPUT": ActionType.ENTER,
                "TYPE": ActionType.ENTER,
                "FILL": ActionType.ENTER,
                "CHOOSE": ActionType.SELECT,
                "PICK": ActionType.SELECT,
                "ATTACH": ActionType.UPLOAD,
                "FILE": ActionType.UPLOAD,
                "CHECK": ActionType.CONFIRM,
                "AGREE": ActionType.CONFIRM,
                "SUBMIT": ActionType.SUBMIT_REVIEW,
                "VERIFY": ActionType.REVIEW,
            }
            if val_upper in mapping:
                return mapping[val_upper]
        return v


class GuidedModeResponse(BaseModel):
    """Structured response returned by Guided Mode generation."""
    title: str = Field(description="Human-readable title of the guided process.")
    overview: str = Field(description="Brief orientation explaining the purpose and scope of this guide.")
    currentStage: str = Field(description="Name of the current workflow stage.")
    totalStages: int = Field(ge=1, description="Total number of stages in the workflow.")
    progressPercent: float = Field(ge=0.0, le=100.0, description="Calculated workflow progress percentage.")
    steps: List[GuidedStep] = Field(default_factory=list, description="Ordered progressive guidance steps.")
    warnings: List[str] = Field(
        default_factory=list,
        description="Non-blocking notices, grounding issue logs, or barrier warnings."
    )
    completionMessage: Optional[str] = Field(
        default=None,
        description="Message displayed once all steps in the current stage are reviewed."
    )
    provider: str = Field(default="mock", description="AI provider or generator used.")
    model: str = Field(default="mock-deterministic-v1", description="Model name.")
    durationMs: Optional[float] = Field(default=None, description="Generation duration in milliseconds.")
    fallbackUsed: bool = Field(
        default=False,
        description="True if guidance was generated via deterministic fallback engine."
    )


class GuidedModeStartRequest(BaseModel):
    """Request payload sent to start Guided Mode for the current page."""
    page: Dict[str, Any] = Field(description="Page metadata (title, URL, hostname).")
    representation: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Structured PageRepresentation extracted from the DOM."
    )
    accessibilityReport: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Deterministic AccessibilityReport from Phase 4."
    )
    aiPageAnalysis: Optional[Dict[str, Any]] = Field(
        default=None,
        description="AIPageAnalysisResponse produced in Phase 5."
    )
    userGoal: Optional[str] = Field(default=None, max_length=500, description="Optional stated user goal.")
    targetStageIndex: Optional[int] = Field(
        default=None,
        ge=0,
        description="Optional 0-indexed stage to generate guidance for."
    )
