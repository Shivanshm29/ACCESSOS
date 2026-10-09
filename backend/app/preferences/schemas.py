"""
ACCESSOS User Preferences Schemas (Phase 10)
Defines strongly typed models, enums, and request/response structures.
"""

from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.preferences.constants import PREFERENCES_VERSION, DISALLOWED_PREFERENCE_KEYWORDS


class LanguageCode(str, Enum):
    EN = "en"
    HI = "hi"


class ExplanationComplexity(str, Enum):
    SIMPLE = "SIMPLE"
    STANDARD = "STANDARD"
    DETAILED = "DETAILED"


class ConfirmationVerbosity(str, Enum):
    STANDARD = "STANDARD"
    DETAILED = "DETAILED"


class UserPreferences(BaseModel):
    """
    Strongly typed user preferences configuration.
    Strictly forbids extra or arbitrary fields (no arbitrary blobs, tokens, passwords).
    """
    model_config = ConfigDict(extra="forbid")

    version: int = Field(default=PREFERENCES_VERSION, description="Schema version number")
    language: LanguageCode = Field(default=LanguageCode.EN, description="Active UI language")
    explanationMode: ExplanationComplexity = Field(
        default=ExplanationComplexity.STANDARD,
        description="Preferred explanation complexity for Explain Anything"
    )
    highContrast: bool = Field(default=False, description="Enable high contrast visuals")
    largerText: bool = Field(default=False, description="Enable larger typography scale")
    reducedDensity: bool = Field(default=False, description="Enable relaxed spacing layout")
    guidedShowWhy: bool = Field(default=True, description="Display Why This Matters context in Guided Mode")
    guidedShowWarnings: bool = Field(default=True, description="Display non-critical informational warnings in Guided Mode")
    guidedShowProgress: bool = Field(default=True, description="Display step progress indicator in Guided Mode")
    confirmationVerbosity: ConfirmationVerbosity = Field(
        default=ConfirmationVerbosity.STANDARD,
        description="Confirmation dialog explanation verbosity"
    )
    documentShowEvidence: bool = Field(default=True, description="Display grounded evidence snippets in Document Intelligence")
    documentShowConfidence: bool = Field(default=True, description="Display confidence scores in Document Intelligence")
    analyticsEnabled: bool = Field(default=True, description="Enable privacy-preserving local on-device analytics")

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: int) -> int:
        if v < 1:
            return PREFERENCES_VERSION
        return v


class PreferenceUpdateRequest(BaseModel):
    """
    Request model for partial or full preference updates.
    Strictly forbids extra fields to prevent injection of arbitrary or sensitive keys.
    """
    model_config = ConfigDict(extra="forbid")

    version: Optional[int] = None
    language: Optional[LanguageCode] = None
    explanationMode: Optional[ExplanationComplexity] = None
    highContrast: Optional[bool] = None
    largerText: Optional[bool] = None
    reducedDensity: Optional[bool] = None
    guidedShowWhy: Optional[bool] = None
    guidedShowWarnings: Optional[bool] = None
    guidedShowProgress: Optional[bool] = None
    confirmationVerbosity: Optional[ConfirmationVerbosity] = None
    documentShowEvidence: Optional[bool] = None
    documentShowConfidence: Optional[bool] = None
    analyticsEnabled: Optional[bool] = None


class PreferenceResponse(BaseModel):
    preferences: UserPreferences
    status: str = "success"
    message: str = "Preferences validated successfully"


class PreferenceHealthResponse(BaseModel):
    status: str = "ok"
    version: int = PREFERENCES_VERSION
    supportedLanguages: List[str]
