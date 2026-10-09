"""ACCESSOS Safe Interaction Engine Schemas (Phase 8).

Strict data models for allowlisted interaction intents, results, and policies.
The AI is NOT an execution authority; interaction intents describe proposed actions
that must pass strict target and policy validation before any execution occurs.
"""

from enum import Enum
import re
import time
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    """Allowlisted action types permitted in Phase 8."""
    FOCUS = "FOCUS"
    TYPE = "TYPE"
    SELECT_OPTION = "SELECT_OPTION"
    TOGGLE_CHECKBOX = "TOGGLE_CHECKBOX"
    HIGHLIGHT = "HIGHLIGHT"
    CLEAR_HIGHLIGHT = "CLEAR_HIGHLIGHT"


# Explicitly blocked action types that must NEVER be executed in Phase 8
BLOCKED_ACTION_STRINGS = {
    "SUBMIT",
    "NAVIGATE",
    "DELETE",
    "PURCHASE",
    "SEND",
    "LOGIN",
    "DOWNLOAD",
    "UPLOAD",
    "EXECUTE_SCRIPT",
    "CLICK_SUBMIT",
}


class RiskLevel(str, Enum):
    """Safety risk classification for proposed interactions."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    BLOCKED = "BLOCKED"


class IntentSource(str, Enum):
    """Origin of the interaction proposal."""
    USER = "USER"
    GUIDED_MODE = "GUIDED_MODE"
    AI_SUGGESTION = "AI_SUGGESTION"


class ValueSource(str, Enum):
    """Provenance of the value to be entered into a form field."""
    USER_EXPLICIT = "USER_EXPLICIT"
    AI_GENERATED = "AI_GENERATED"
    NONE = "NONE"


class InteractionStatus(str, Enum):
    """Execution status for an interaction attempt."""
    SUCCESS = "SUCCESS"
    REJECTED = "REJECTED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"
    TARGET_NOT_FOUND = "TARGET_NOT_FOUND"
    TARGET_INVALID = "TARGET_INVALID"
    NOT_ALLOWED = "NOT_ALLOWED"
    ERROR = "ERROR"


# Strict pattern for stable ACCESSOS element IDs
# Rejects CSS selectors ('>', '#', '.', '['), XPath ('//', '@'), and scripts
STABLE_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]+$")


class InteractionIntent(BaseModel):
    """Structured proposal for an atomic, allowlisted browser interaction."""
    actionId: str = Field(description="Unique identifier for tracking this atomic interaction")
    actionType: ActionType = Field(description="Strict allowlisted ActionType")
    targetElementId: str = Field(description="Stable ACCESSOS element ID (not a selector or XPath)")
    value: Optional[str] = Field(default=None, description="Explicit user-approved value for TYPE action")
    valueSource: ValueSource = Field(default=ValueSource.NONE, description="Provenance of value for TYPE action")
    optionValue: Optional[str] = Field(default=None, description="Exact option value for SELECT_OPTION")
    checked: Optional[bool] = Field(default=None, description="Target checked state for TOGGLE_CHECKBOX")
    reason: Optional[str] = Field(default=None, description="Human-understandable rationale for the action")
    riskLevel: RiskLevel = Field(default=RiskLevel.LOW, description="Safety risk classification")
    requiresConfirmation: bool = Field(default=True, description="Whether user confirmation is required")
    source: IntentSource = Field(default=IntentSource.USER, description="Source of the intent")

    @field_validator("actionId")
    @classmethod
    def validate_action_id(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("actionId cannot be empty")
        if len(clean) > 100:
            raise ValueError("actionId exceeds maximum length of 100")
        return clean

    @field_validator("targetElementId")
    @classmethod
    def validate_target_id(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("targetElementId cannot be empty")
        # Reject arbitrary CSS selectors or XPath patterns
        if any(char in clean for char in [" ", ">", "+", "~", "#", ".", "[", "]", ":", "/", "\\", "(", ")", ";"]):
            raise ValueError(f"targetElementId contains invalid selector characters: {clean}")
        if not STABLE_ID_PATTERN.match(clean):
            raise ValueError(f"targetElementId does not match valid stable ID pattern: {clean}")
        if len(clean) > 150:
            raise ValueError("targetElementId exceeds maximum length of 150")
        return clean

    @field_validator("value")
    @classmethod
    def sanitize_type_value(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        # Enforce reasonable length and reject obvious script/executable injections
        if len(v) > 2000:
            raise ValueError("Type value exceeds maximum allowed length of 2000 characters")
        if any(bad in v.lower() for bad in ["<script", "javascript:", "eval(", "new function"]):
            raise ValueError("Executable code detected in value; rejected")
        return v


class InteractionResult(BaseModel):
    """Structured, verified outcome of an interaction execution."""
    actionId: str
    status: InteractionStatus
    actionType: ActionType
    targetElementId: str
    message: str
    changed: bool = False
    blockedReason: Optional[str] = None
    requiresConfirmation: bool = False
    timestamp: float = Field(default_factory=time.time)


class ValidateIntentRequest(BaseModel):
    """Request to validate an interaction intent against safety policies."""
    intent: InteractionIntent
    isSensitiveField: bool = False
    fieldRole: Optional[str] = None
    fieldType: Optional[str] = None


class ValidateIntentResponse(BaseModel):
    """Validation decision with safety assessment and confirmation requirement."""
    valid: bool
    intent: InteractionIntent
    riskLevel: RiskLevel
    requiresConfirmation: bool
    blocked: bool
    blockedReason: Optional[str] = None
