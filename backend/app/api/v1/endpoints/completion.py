"""
ACCESSOS Completion Checker API Endpoints (Phase 12)
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from app.completion.schemas import CompletionResult
from app.completion.checker import evaluate_completion
from app.security import (
    record_security_event,
    DataClassification,
    SecurityErrorCode,
    SafeErrorResponse,
)

router = APIRouter()


class CompletionEvaluateRequest(BaseModel):
    representation: Dict[str, Any] = Field(..., description="Semantic PageRepresentation")
    form_values: Optional[Dict[str, Any]] = Field(default_factory=dict, alias="formValues")
    document_matches: Optional[List[Dict[str, Any]]] = Field(default_factory=list, alias="documentMatches")
    current_stage_index: int = Field(default=0, alias="currentStageIndex")

    model_config = ConfigDict(populate_by_name=True)


@router.get("/health")
def completion_health():
    """Health check for completion verification service."""
    return {
        "status": "ready",
        "module": "completion",
        "version": 1,
        "authoritative": "deterministic",
    }


@router.post("/evaluate", response_model=CompletionResult)
def evaluate_workflow_completion(payload: CompletionEvaluateRequest):
    """
    Evaluates workflow completion deterministically.
    Does not mutate browser state.
    """
    try:
        result = evaluate_completion(
            page_representation=payload.representation,
            form_values=payload.form_values,
            document_matches=payload.document_matches,
            current_stage_index=payload.current_stage_index,
        )

        record_security_event(
            feature="COMPLETION",
            event_name="COMPLETION_EVALUATION",
            status="SUCCESS",
            reason=f"Status: {result.overall_status.value}, Percent: {result.completion_percent}%",
        )

        return result
    except Exception as exc:
        record_security_event(
            feature="COMPLETION",
            event_name="COMPLETION_EVALUATION_ERROR",
            status="FAILED",
            reason=f"Evaluation failed: {str(exc)[:100]}",
        )
        raise HTTPException(
            status_code=400,
            detail=SafeErrorResponse(
                error_code=SecurityErrorCode.INTERNAL_ERROR,
                message="Workflow completion evaluation failed safely.",
            ).model_dump(),
        )
