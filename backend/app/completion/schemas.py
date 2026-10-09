"""
ACCESSOS Completion Checker Schemas (Phase 12)
Strongly typed domain models for application completion verification.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CompletionStatus(str, Enum):
    COMPLETE = "COMPLETE"
    INCOMPLETE = "INCOMPLETE"
    BLOCKED = "BLOCKED"
    INVALID = "INVALID"
    UNKNOWN = "UNKNOWN"
    COMPLETION_UNSUPPORTED = "COMPLETION_UNSUPPORTED"
    INSUFFICIENT_STRUCTURED_REQUIREMENTS = "INSUFFICIENT_STRUCTURED_REQUIREMENTS"


class RequirementType(str, Enum):
    REQUIRED_FIELD = "REQUIRED_FIELD"
    REQUIRED_DOCUMENT = "REQUIRED_DOCUMENT"
    VALIDATION = "VALIDATION"
    CONSISTENCY = "CONSISTENCY"
    CONFIRMATION = "CONFIRMATION"
    WORKFLOW_STAGE = "WORKFLOW_STAGE"


class RequirementSeverity(str, Enum):
    BLOCKING = "BLOCKING"
    WARNING = "WARNING"
    INFO = "INFO"


class ConsistencyStatus(str, Enum):
    CONSISTENT = "CONSISTENT"
    INCONSISTENT = "INCONSISTENT"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class CompletionRequirement(BaseModel):
    id: str = Field(..., description="Stable requirement identifier")
    type: RequirementType = Field(..., description="Type of requirement")
    title: str = Field(..., description="Human-readable requirement title")
    description: str = Field(..., description="Clear explanation of requirement and purpose")
    status: CompletionStatus = Field(..., description="Current status of the requirement")
    severity: RequirementSeverity = Field(default=RequirementSeverity.BLOCKING)
    target_element_id: Optional[str] = Field(None, description="Related stable DOM target ID")
    related_document_id: Optional[str] = Field(None, description="Related document ID if applicable")
    stage_id: Optional[str] = Field(None, description="Associated workflow stage ID")
    stage_name: Optional[str] = Field(None, description="Associated workflow stage name")
    reason: str = Field(..., description="Traceable factual reason for status")
    evidence: Optional[str] = Field(None, description="Bounded evidence snippet if applicable")
    suggested_next_step: str = Field(..., description="Actionable instruction for user (not automated)")
    is_blocking: bool = Field(default=True, description="Whether this issue blocks workflow completion")
    sensitive: bool = Field(default=False, description="Safe metadata indicating whether field is sensitive")


class StageCompletionSummary(BaseModel):
    stage_index: int = Field(..., description="0-indexed stage number")
    stage_id: str = Field(..., description="Stage section identifier")
    stage_name: str = Field(..., description="Human-readable stage title")
    status: CompletionStatus = Field(..., description="Status of the stage")
    total_requirements: int = Field(default=0)
    completed_requirements: int = Field(default=0)
    blocking_issues_count: int = Field(default=0)
    warning_issues_count: int = Field(default=0)


class ConsistencyCheckResult(BaseModel):
    rule_id: str = Field(..., description="Unique consistency check rule identifier")
    rule_name: str = Field(..., description="Human-readable rule name")
    status: ConsistencyStatus = Field(..., description="Outcome of consistency evaluation")
    field_ids: List[str] = Field(default_factory=list, description="IDs of fields evaluated")
    explanation: str = Field(..., description="Grounded explanation of consistency or discrepancy")
    is_blocking: bool = Field(default=False, description="Whether inconsistency blocks completion")


class DocumentRequirementStatus(BaseModel):
    requirement_id: str = Field(..., description="Unique document requirement identifier")
    document_type: str = Field(..., description="Expected document classification")
    title: str = Field(..., description="Human-readable requirement title")
    match_status: str = Field(..., description="MATCH, PARTIAL_MATCH, NO_MATCH, AMBIGUOUS, NOT_ENOUGH_EVIDENCE")
    document_id: Optional[str] = Field(None, description="Matched document ID")
    document_name: Optional[str] = Field(None, description="Sanitized document filename")
    confidence: Optional[float] = Field(None, description="Match confidence score [0.0, 1.0]")
    evidence: Optional[str] = Field(None, description="Bounded extracted evidence quote")
    reason: str = Field(..., description="Explanation of match or mismatch")
    suggested_next_step: str = Field(..., description="Action for the user to resolve requirement")
    is_satisfied: bool = Field(default=False)
    is_blocking: bool = Field(default=True)


class CompletionResult(BaseModel):
    overall_status: CompletionStatus = Field(..., description="Authoritative workflow completion status")
    completion_percent: int = Field(..., ge=0, le=100, description="Deterministic completion percentage")
    current_stage_index: int = Field(default=0)
    current_stage_name: str = Field(default="")
    blocking_issues: List[CompletionRequirement] = Field(default_factory=list)
    warnings: List[CompletionRequirement] = Field(default_factory=list)
    completed_requirements: List[CompletionRequirement] = Field(default_factory=list)
    remaining_requirements: List[CompletionRequirement] = Field(default_factory=list)
    stage_summaries: List[StageCompletionSummary] = Field(default_factory=list)
    document_requirements: List[DocumentRequirementStatus] = Field(default_factory=list)
    consistency_checks: List[ConsistencyCheckResult] = Field(default_factory=list)
    timestamp: int = Field(..., description="Epoch milliseconds")
    evaluated_field_count: int = Field(default=0)
    evaluated_document_count: int = Field(default=0)
