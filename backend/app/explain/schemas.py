"""Pydantic schemas and contracts for Phase 7 Explain Anything."""
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ExplanationMode(str, Enum):
    """Controlled modes for explaining selected webpage text."""
    SIMPLE = "SIMPLE"
    DETAILED = "DETAILED"
    PLAIN_LANGUAGE = "PLAIN_LANGUAGE"
    EXAMPLE = "EXAMPLE"
    KEY_POINTS = "KEY_POINTS"


class ExplainSelectionContext(BaseModel):
    """Bounded, privacy-safe contextual metadata surrounding the selected text."""
    pageTitle: Optional[str] = Field(default=None, max_length=200)
    sectionHeading: Optional[str] = Field(default=None, max_length=200)
    targetElementId: Optional[str] = Field(default=None, max_length=100)
    contextBefore: Optional[str] = Field(default=None, max_length=500)
    contextAfter: Optional[str] = Field(default=None, max_length=500)
    elementRole: Optional[str] = Field(default=None, max_length=50)


class ExplainAnythingRequest(BaseModel):
    """Inbound request payload for explaining selected text."""
    selectedText: str = Field(..., min_length=1, max_length=1000)
    context: Optional[ExplainSelectionContext] = None
    mode: ExplanationMode = Field(default=ExplanationMode.SIMPLE)
    userGoal: Optional[str] = Field(default=None, max_length=300)

    @field_validator("mode", mode="before")
    @classmethod
    def normalize_mode(cls, v):
        if isinstance(v, str):
            v_clean = v.strip().upper().replace(" ", "_").replace("-", "_")
            if v_clean in ExplanationMode._value2member_map_:
                return ExplanationMode(v_clean)
            # Common synonyms / aliases
            if v_clean in ("SHORT", "BRIEF", "CONCISE", "EASY"):
                return ExplanationMode.SIMPLE
            if v_clean in ("LONG", "COMPREHENSIVE", "DEEP", "IN_DEPTH"):
                return ExplanationMode.DETAILED
            if v_clean in ("PLAIN", "SIMPLIFIED", "BASIC", "EASY_READ"):
                return ExplanationMode.PLAIN_LANGUAGE
            if v_clean in ("SCENARIO", "ILLUSTRATION", "SAMPLE"):
                return ExplanationMode.EXAMPLE
            if v_clean in ("BULLETS", "POINTS", "SUMMARY", "HIGHLIGHTS"):
                return ExplanationMode.KEY_POINTS
        return v


class TermDefinition(BaseModel):
    """Explanation of an individual unfamiliar word or jargon term."""
    term: str = Field(..., max_length=150)
    definition: str = Field(..., max_length=500)


class ExplainAnythingResponse(BaseModel):
    """Strictly structured explanation output matching ACCESSOS UI requirements."""
    explanation: str = Field(..., description="Clear plain-language explanation of the selected text.")
    whyItMatters: Optional[str] = Field(default=None, description="Why this information or requirement matters.")
    keyPoints: List[str] = Field(default_factory=list, description="Bullet-point takeaways.")
    terminology: List[TermDefinition] = Field(default_factory=list, description="Definitions of dense terms.")
    example: Optional[str] = Field(default=None, description="Concrete practical example or scenario.")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Model confidence score.")
    sourceSummary: str = Field(default="", description="Summary of what is directly stated vs interpreted.")
    warnings: List[str] = Field(default_factory=list, description="Ambiguity or sanitization notes.")
    mode: ExplanationMode = Field(default=ExplanationMode.SIMPLE)
    provider: str = Field(default="mock")
    model: str = Field(default="mock-v1")
    durationMs: Optional[float] = None
    fallbackUsed: bool = Field(default=False)
