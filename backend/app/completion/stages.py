"""
ACCESSOS Stage Mapping Engine (Phase 12)
Maps workflow stages to section IDs and calculates per-stage completion.
"""

from typing import List, Dict, Any, Optional
from app.completion.schemas import StageCompletionSummary, CompletionStatus, CompletionRequirement


PORTAL_STAGES = [
    {
        "index": 0,
        "id": "sec-applicant",
        "name": "Applicant Identification & Basic Details",
        "step": 1,
    },
    {
        "index": 1,
        "id": "sec-personal",
        "name": "Personal Details & Identity",
        "step": 2,
    },
    {
        "index": 2,
        "id": "sec-academic",
        "name": "Academic Enrollment & Institutional Details",
        "step": 3,
    },
    {
        "index": 3,
        "id": "sec-family",
        "name": "Family Background & Income Appraisal",
        "step": 4,
    },
    {
        "index": 4,
        "id": "sec-address",
        "name": "Residential & Communication Address",
        "step": 5,
    },
    {
        "index": 5,
        "id": "sec-bank",
        "name": "Direct Benefit Transfer (DBT) Bank Account",
        "step": 6,
    },
    {
        "index": 6,
        "id": "sec-documents",
        "name": "Supporting Documents Upload & Verification",
        "step": 7,
    },
    {
        "index": 7,
        "id": "sec-declaration",
        "name": "Statutory Declaration & Application Finalization",
        "step": 8,
    },
]


def evaluate_stage_summaries(
    requirements: List[CompletionRequirement],
    custom_stages: Optional[List[Dict[str, Any]]] = None,
) -> List[StageCompletionSummary]:
    """
    Computes completion summaries for each stage based on associated requirements.
    """
    stages = custom_stages or PORTAL_STAGES
    summaries: List[StageCompletionSummary] = []

    for stage_info in stages:
        s_id = stage_info.get("id", "")
        s_name = stage_info.get("name", "")
        s_index = stage_info.get("index", 0)

        stage_reqs = [r for r in requirements if r.stage_id == s_id]
        total_reqs = len(stage_reqs)
        completed_reqs = len([r for r in stage_reqs if r.status == CompletionStatus.COMPLETE])
        blocking_count = len([r for r in stage_reqs if r.is_blocking and r.status != CompletionStatus.COMPLETE])
        warning_count = len([r for r in stage_reqs if not r.is_blocking and r.status != CompletionStatus.COMPLETE])

        if total_reqs == 0:
            status = CompletionStatus.COMPLETE
        elif blocking_count > 0:
            status = CompletionStatus.INCOMPLETE
        elif completed_reqs == total_reqs:
            status = CompletionStatus.COMPLETE
        else:
            status = CompletionStatus.INCOMPLETE

        summaries.append(
            StageCompletionSummary(
                stage_index=s_index,
                stage_id=s_id,
                stage_name=s_name,
                status=status,
                total_requirements=total_reqs,
                completed_requirements=completed_reqs,
                blocking_issues_count=blocking_count,
                warning_issues_count=warning_count,
            )
        )

    return summaries
