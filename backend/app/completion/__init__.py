"""
ACCESSOS Completion Checker Module (Phase 12)
Centralized exports for completion verification schemas and evaluation functions.
"""

from app.completion.schemas import (
    CompletionStatus,
    RequirementType,
    RequirementSeverity,
    ConsistencyStatus,
    CompletionRequirement,
    StageCompletionSummary,
    ConsistencyCheckResult,
    DocumentRequirementStatus,
    CompletionResult,
)
from app.completion.consistency import evaluate_cross_field_consistency
from app.completion.stages import evaluate_stage_summaries, PORTAL_STAGES
from app.completion.checker import evaluate_completion

__all__ = [
    "CompletionStatus",
    "RequirementType",
    "RequirementSeverity",
    "ConsistencyStatus",
    "CompletionRequirement",
    "StageCompletionSummary",
    "ConsistencyCheckResult",
    "DocumentRequirementStatus",
    "CompletionResult",
    "evaluate_cross_field_consistency",
    "evaluate_stage_summaries",
    "PORTAL_STAGES",
    "evaluate_completion",
]
